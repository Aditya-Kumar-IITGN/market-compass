import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  BarSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import { fetchMarketKlines, subscribeMarketKline, parseSymbol, type Candle, type Interval } from "@/lib/market";
import {
  sma, ema, wma, vwap, rsi, macd, bollinger,
} from "@/lib/indicators";
import type { IndicatorConfig } from "./types";

export type ChartType = "candles" | "heikin" | "line" | "area" | "bars";

interface Props {
  symbol: string;
  interval: Interval;
  chartType: ChartType;
  indicators: IndicatorConfig[];
  onCandles?: (c: Candle[]) => void;
}

function toHeikin(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    const high = Math.max(c.high, open, close);
    const low = Math.min(c.low, open, close);
    out.push({ time: c.time, open, high, low, close, volume: c.volume });
  }
  return out;
}

const COLORS = ["#22d3ee", "#f59e0b", "#a78bfa", "#f472b6", "#4ade80", "#f87171"];

export function Chart({ symbol, interval, chartType, indicators, onCandles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [hover, setHover] = useState<Candle | null>(null);

  const hasRsi = indicators.some((i) => i.type === "rsi" && i.visible);
  const hasMacd = indicators.some((i) => i.type === "macd" && i.visible);

  // Main chart
  const mainRef = useRef<{
    chart: IChartApi;
    price: ISeriesApi<"Candlestick" | "Line" | "Area" | "Bar">;
    volume: ISeriesApi<"Histogram">;
    overlays: ISeriesApi<"Line">[];
  } | null>(null);
  const rsiRef = useRef<{ chart: IChartApi; series: ISeriesApi<"Line"> } | null>(null);
  const macdRef = useRef<{
    chart: IChartApi;
    macd: ISeriesApi<"Line">;
    signal: ISeriesApi<"Line">;
    hist: ISeriesApi<"Histogram">;
  } | null>(null);

  // Setup main chart
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    let price: ISeriesApi<"Candlestick" | "Line" | "Area" | "Bar">;
    if (chartType === "line") {
      price = chart.addSeries(LineSeries, { color: "#22d3ee", lineWidth: 2 });
    } else if (chartType === "area") {
      price = chart.addSeries(AreaSeries, {
        lineColor: "#22d3ee",
        topColor: "rgba(34,211,238,0.35)",
        bottomColor: "rgba(34,211,238,0)",
        lineWidth: 2,
      });
    } else if (chartType === "bars") {
      price = chart.addSeries(BarSeries, { upColor: "#22c55e", downColor: "#ef4444" });
    } else {
      price = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
    }

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(148,163,184,0.4)",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    mainRef.current = { chart, price, volume, overlays: [] };

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) { setHover(null); return; }
      const bar = param.seriesData.get(price) as { open?: number; high?: number; low?: number; close?: number; value?: number } | undefined;
      if (!bar) { setHover(null); return; }
      if ("close" in bar && typeof bar.close === "number") {
        setHover({
          time: param.time as number,
          open: bar.open ?? 0, high: bar.high ?? 0, low: bar.low ?? 0, close: bar.close, volume: 0,
        });
      } else if (typeof bar.value === "number") {
        setHover({ time: param.time as number, open: bar.value, high: bar.value, low: bar.value, close: bar.value, volume: 0 });
      }
    });

    return () => { chart.remove(); mainRef.current = null; };
  }, [chartType]);

  // RSI pane
  useEffect(() => {
    if (!hasRsi || !rsiContainerRef.current) return;
    const chart = createChart(rsiContainerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      grid: { vertLines: { color: "rgba(148,163,184,0.05)" }, horzLines: { color: "rgba(148,163,184,0.05)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { visible: false },
      autoSize: true,
      handleScroll: true,
      handleScale: true,
    });
    const series = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 2 });
    series.createPriceLine({ price: 70, color: "rgba(239,68,68,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    series.createPriceLine({ price: 30, color: "rgba(34,197,94,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    rsiRef.current = { chart, series };
    return () => { chart.remove(); rsiRef.current = null; };
  }, [hasRsi]);

  // MACD pane
  useEffect(() => {
    if (!hasMacd || !macdContainerRef.current) return;
    const chart = createChart(macdContainerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      grid: { vertLines: { color: "rgba(148,163,184,0.05)" }, horzLines: { color: "rgba(148,163,184,0.05)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { visible: false },
      autoSize: true,
    });
    const macdLine = chart.addSeries(LineSeries, { color: "#22d3ee", lineWidth: 2 });
    const signal = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2 });
    const hist = chart.addSeries(HistogramSeries, { color: "rgba(148,163,184,0.5)" });
    macdRef.current = { chart, macd: macdLine, signal, hist };
    return () => { chart.remove(); macdRef.current = null; };
  }, [hasMacd]);

  // Load data on symbol/interval change
  useEffect(() => {
    let cancelled = false;
    fetchMarketKlines(symbol, interval, 800).then((data) => {
      if (cancelled) return;
      setCandles(data);
      onCandles?.(data);
    }).catch((e) => console.error(e));
    return () => { cancelled = true; };
  }, [symbol, interval, onCandles]);

  // Live subscribe
  useEffect(() => {
    const unsub = subscribeMarketKline(symbol, interval, (c) => {
      setCandles((prev) => {
        if (prev.length === 0) return [c];
        const last = prev[prev.length - 1];
        const next = [...prev];
        if (c.time === last.time) next[next.length - 1] = c;
        else if (c.time > last.time) next.push(c);
        return next;
      });
    });
    return unsub;
  }, [symbol, interval]);

  // Push candles + indicators to series
  useEffect(() => {
    const m = mainRef.current;
    if (!m || candles.length === 0) return;

    const displayCandles = chartType === "heikin" ? toHeikin(candles) : candles;

    if (chartType === "line" || chartType === "area") {
      (m.price as ISeriesApi<"Line">).setData(
        displayCandles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })),
      );
    } else {
      (m.price as ISeriesApi<"Candlestick">).setData(
        displayCandles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open, high: c.high, low: c.low, close: c.close,
        })),
      );
    }

    m.volume.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
      })),
    );

    // Clear old overlays
    for (const s of m.overlays) m.chart.removeSeries(s);
    m.overlays = [];

    let colorIdx = 0;
    const nextColor = () => COLORS[colorIdx++ % COLORS.length];

    for (const ind of indicators) {
      if (!ind.visible) continue;
      if (ind.type === "sma" || ind.type === "ema" || ind.type === "wma" || ind.type === "vwap") {
        let data;
        if (ind.type === "sma") data = sma(candles, ind.period);
        else if (ind.type === "ema") data = ema(candles, ind.period);
        else if (ind.type === "wma") data = wma(candles, ind.period);
        else data = vwap(candles);
        const s = m.chart.addSeries(LineSeries, {
          color: ind.color || nextColor(),
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        m.overlays.push(s);
      } else if (ind.type === "bb") {
        const { upper, middle, lower } = bollinger(candles, ind.period, ind.mult);
        const color = ind.color || "#94a3b8";
        for (const line of [upper, middle, lower]) {
          const s = m.chart.addSeries(LineSeries, {
            color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          });
          s.setData(line.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
          m.overlays.push(s);
        }
      }
    }

    // RSI pane update
    if (rsiRef.current) {
      const cfg = indicators.find(
        (i): i is Extract<IndicatorConfig, { type: "rsi" }> => i.type === "rsi" && i.visible,
      );
      if (cfg) {
        const data = rsi(candles, cfg.period);
        rsiRef.current.series.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
    }

    // MACD pane update
    if (macdRef.current) {
      const cfg = indicators.find(
        (i): i is Extract<IndicatorConfig, { type: "macd" }> => i.type === "macd" && i.visible,
      );
      if (cfg) {
        const { macd: ml, signal, hist } = macd(candles, cfg.fast, cfg.slow, cfg.signal);
        macdRef.current.macd.setData(ml.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        macdRef.current.signal.setData(signal.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        macdRef.current.hist.setData(hist.map((p) => ({
          time: p.time as UTCTimestamp, value: p.value,
          color: p.value >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
        })));
      }
    }
  }, [candles, indicators, chartType]);

  // Sync time scales
  useEffect(() => {
    const main = mainRef.current?.chart;
    if (!main) return;
    const others = [rsiRef.current?.chart, macdRef.current?.chart].filter(Boolean) as IChartApi[];
    if (others.length === 0) return;
    const sync = () => {
      const range = main.timeScale().getVisibleLogicalRange();
      if (range) for (const c of others) c.timeScale().setVisibleLogicalRange(range);
    };
    main.timeScale().subscribeVisibleLogicalRangeChange(sync);
    return () => { main.timeScale().unsubscribeVisibleLogicalRangeChange(sync); };
  }, [hasRsi, hasMacd]);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const displayed = hover ?? last;
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev ? (change / prev.close) * 100 : 0;

  const fmt = useMemo(() => (n: number | undefined) => {
    if (n === undefined || !isFinite(n)) return "—";
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(6);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* OHLC bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 text-[11px] tabular border-b border-border/60 bg-surface/40">
        <span className="text-muted-foreground">O <span className="text-foreground">{fmt(displayed?.open)}</span></span>
        <span className="text-muted-foreground">H <span className="text-foreground">{fmt(displayed?.high)}</span></span>
        <span className="text-muted-foreground">L <span className="text-foreground">{fmt(displayed?.low)}</span></span>
        <span className="text-muted-foreground">C <span className="text-foreground">{fmt(displayed?.close)}</span></span>
        <span className={change >= 0 ? "text-bull" : "text-bear"}>
          {change >= 0 ? "+" : ""}{fmt(change)} ({changePct.toFixed(2)}%)
        </span>
        <span className="ml-auto text-muted-foreground">
          {candles.length} bars · <span className="text-primary">live</span>
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
      {hasRsi && (
        <div className="border-t border-border/60">
          <div className="px-3 py-1 text-[10px] text-muted-foreground bg-surface/40 flex items-center gap-2">
            <span className="text-foreground font-medium">RSI</span>
            <span>({indicators.find((i) => i.type === "rsi")?.period ?? 14})</span>
          </div>
          <div ref={rsiContainerRef} style={{ height: 120 }} />
        </div>
      )}
      {hasMacd && (
        <div className="border-t border-border/60">
          <div className="px-3 py-1 text-[10px] text-muted-foreground bg-surface/40 flex items-center gap-2">
            <span className="text-foreground font-medium">MACD</span>
          </div>
          <div ref={macdContainerRef} style={{ height: 140 }} />
        </div>
      )}
    </div>
  );
}
