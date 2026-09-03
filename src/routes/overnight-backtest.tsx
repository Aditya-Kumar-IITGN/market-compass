import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowLeft, Play, Loader2, TrendingUp, Moon,
  BarChart3, Globe, ChevronUp, ChevronDown, X, Award, AlertTriangle,
} from "lucide-react";
import {
  createChart, LineSeries, type IChartApi, type UTCTimestamp, type ISeriesApi,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import type { OvernightSummary, StrategyMetrics, PortfolioMetrics } from "@/lib/overnight-backtest";

export const Route = createFileRoute("/overnight-backtest")({
  head: () => ({ meta: [{ title: "Overnight Backtest — QuantDesk" }] }),
  component: Page,
});

type LightResult = Omit<import("@/lib/overnight-backtest").OvernightResult, "equity" | "daytimeEquity" | "buyHoldEquity">;
type SortKey = "symbol" | "region" | "buyHoldReturnPct"
  | "o_totalReturnPct" | "o_netProfit" | "o_wins" | "o_losses" | "o_winRate" | "o_sharpe" | "o_maxDrawdownPct" | "o_profitFactor" | "o_annualizedReturnPct" | "o_annualStdDev" | "o_sortinoRatio"
  | "d_totalReturnPct" | "d_netProfit" | "d_wins" | "d_losses" | "d_winRate" | "d_sharpe" | "d_maxDrawdownPct";

function getSortValue(r: LightResult, key: SortKey): number | string {
  if (key === "symbol") return r.symbol;
  if (key === "region") return r.region;
  if (key === "buyHoldReturnPct") return r.buyHoldReturnPct;
  if (key.startsWith("o_")) return (r.overnight as any)[key.slice(2)] ?? 0;
  if (key.startsWith("d_")) return (r.daytime as any)[key.slice(2)] ?? 0;
  return 0;
}

function Page() {
  const [initialCapital, setInitialCapital] = useState("100000");
  const [feeModel, setFeeModel] = useState<"bps" | "per_share">("per_share");
  const [feeValue, setFeeValue] = useState("0.01");
  const [compoundMode, setCompoundMode] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [summary, setSummary] = useState<OvernightSummary | null>(null);

  const aggChartRef = useRef<HTMLDivElement>(null);
  const aggChartApi = useRef<IChartApi | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("o_totalReturnPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const stockChartRef = useRef<HTMLDivElement>(null);
  const stockChartApi = useRef<IChartApi | null>(null);

  const run = async () => {
    setRunning(true);
    setProgress("Fetching data for 200+ stocks and running backtests…");
    setSummary(null);
    setSelectedSymbol(null);
    setStockData(null);
    try {
      const res = await fetch("/api/public/market/overnight-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialCapital: Number(initialCapital),
          feeModel,
          feeValue: Number(feeValue),
          compoundMode,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json());
      setProgress("");
    } catch (e) {
      console.error(e);
      setProgress("Failed — check console for details.");
    } finally {
      setRunning(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filteredResults = useMemo(() => {
    if (!summary) return [];
    return [...summary.results]
      .filter(r => !r.error)
      .sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        if (typeof av === "string") return sortDir === "asc" ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
        return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
  }, [summary, sortKey, sortDir]);

  // ── Aggregate chart ──
  useEffect(() => {
    if (!summary || !aggChartRef.current) return;
    if (aggChartApi.current) { aggChartApi.current.remove(); aggChartApi.current = null; }

    const chart = createChart(aggChartRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "rgba(148,163,184,0.08)" }, horzLines: { color: "rgba(148,163,184,0.08)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { borderColor: "rgba(148,163,184,0.2)" },
      autoSize: true,
    });

    const ovn = chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: "Overnight" });
    const day = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: "Daytime" });
    const bh = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 1, title: "Buy & Hold" });

    if (summary.aggregateEquity?.length) ovn.setData(summary.aggregateEquity.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));
    if (summary.aggregateDaytimeEquity?.length) day.setData(summary.aggregateDaytimeEquity.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));
    if (summary.aggregateBuyHoldEquity?.length) bh.setData(summary.aggregateBuyHoldEquity.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));

    chart.timeScale().fitContent();
    aggChartApi.current = chart;

    return () => { chart.remove(); aggChartApi.current = null; };
  }, [summary]);

  // ── Fetch individual stock data when selectedSymbol changes ──
  useEffect(() => {
    if (!selectedSymbol) { setStockData(null); return; }
    let cancelled = false;
    setLoadingStock(true);
    fetch(`/api/public/market/overnight-backtest-single?symbol=${encodeURIComponent(selectedSymbol)}&initialCapital=${initialCapital}&feeModel=${feeModel}&feeValue=${feeValue}&compoundMode=${compoundMode}`)
      .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(data => { if (!cancelled) setStockData(data); })
      .catch(e => { console.error(e); if (!cancelled) setStockData(null); })
      .finally(() => { if (!cancelled) setLoadingStock(false); });
    return () => { cancelled = true; };
  }, [selectedSymbol]);

  // ── Render individual stock chart when data arrives ──
  useEffect(() => {
    if (!stockData || !stockChartRef.current) return;

    // Clean up previous chart
    if (stockChartApi.current) { stockChartApi.current.remove(); stockChartApi.current = null; }

    const chart = createChart(stockChartRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "rgba(148,163,184,0.08)" }, horzLines: { color: "rgba(148,163,184,0.08)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { borderColor: "rgba(148,163,184,0.2)" },
      autoSize: true,
    });

    const ovn = chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: "Overnight" });
    const day = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: "Daytime" });
    const bh = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 1, title: "Buy & Hold" });

    if (stockData.equity?.length) ovn.setData(stockData.equity.map((d: any) => ({ time: d.time as UTCTimestamp, value: d.value })));
    if (stockData.daytimeEquity?.length) day.setData(stockData.daytimeEquity.map((d: any) => ({ time: d.time as UTCTimestamp, value: d.value })));
    if (stockData.buyHoldEquity?.length) bh.setData(stockData.buyHoldEquity.map((d: any) => ({ time: d.time as UTCTimestamp, value: d.value })));

    chart.timeScale().fitContent();
    stockChartApi.current = chart;

    return () => { chart.remove(); stockChartApi.current = null; };
  }, [stockData]);

  const cap = Number(initialCapital);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-surface/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Overnight Strategy Backtest</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">Buy at close → Sell at open · Based on Basdekidou (2017)</span>
          <button onClick={run} disabled={running}
            className="ml-auto h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running…" : "Run Backtest"}
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Progress */}
        {running && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <div className="text-sm font-medium">{progress}</div>
              <div className="text-xs text-muted-foreground mt-0.5">This may take 2–5 minutes depending on Yahoo Finance response times.</div>
            </div>
          </div>
        )}

        {/* Configuration */}
        {!summary && !running && (
          <div className="bg-surface/30 border border-border/50 rounded-lg p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-muted-foreground mb-1.5">Initial Capital ($)</label>
                <input type="number" value={initialCapital} onChange={e => setInitialCapital(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-muted-foreground mb-1.5">Fee Model</label>
                <select value={feeModel} onChange={e => setFeeModel(e.target.value as any)}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50">
                  <option value="per_share">Per Share ($)</option>
                  <option value="bps">Basis Points (bps)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-muted-foreground mb-1.5">Fee Value</label>
                <input type="number" value={feeValue} onChange={e => setFeeValue(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50"
                  step={feeModel === "bps" ? "1" : "0.005"} />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-muted-foreground mb-1.5">Mode</label>
                <select value={compoundMode ? "compound" : "flat"} onChange={e => setCompoundMode(e.target.value === "compound")}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50">
                  <option value="compound">Compound Equity</option>
                  <option value="flat">Flat Capital (Paper)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ RESULTS ═══════ */}
        {summary && (
          <>
            {/* ── Panel 1: Annual Returns (Paper Tables 1/2) ── */}
            <div className="bg-surface/50 border border-border/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider">Annual Returns Comparison (Paper Table 1 & 2)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/20">
                    <tr>
                      <th className="px-4 py-2 text-left">Metric</th>
                      <th className="px-4 py-2 text-right text-green-400">Overnight Strategy</th>
                      <th className="px-4 py-2 text-right text-red-400">Daytime Strategy</th>
                      <th className="px-4 py-2 text-right text-indigo-400">Buy & Hold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    <AnnualRow label="Avg Annual Return" ovn={`${fmt(summary.overnight.avgAnnualReturn)}%`} day={`${fmt(summary.daytime.avgAnnualReturn)}%`} bh={`${fmt(summary.avgBuyHoldReturn)}%`} />
                    <AnnualRow label="Avg Annual Std Dev (σ)" ovn={`${fmt(summary.overnight.avgAnnualStdDev)}%`} day={`${fmt(summary.daytime.avgAnnualStdDev)}%`} bh="—" />
                    <AnnualRow label="Avg Sharpe Ratio" ovn={fmt(summary.overnight.avgSharpe)} day={fmt(summary.daytime.avgSharpe)} bh="—" />
                    <AnnualRow label="Portfolio Sharpe" ovn={fmt(summary.overnight.portfolioSharpe)} day={fmt(summary.daytime.portfolioSharpe)} bh="—" />
                    <AnnualRow label="Avg Total Return" ovn={`${fmt(summary.overnight.avgTotalReturn)}%`} day={`${fmt(summary.daytime.avgTotalReturn)}%`} bh={`${fmt(summary.avgBuyHoldReturn)}%`} />
                    <AnnualRow label="Avg Sortino Ratio" ovn={fmt(summary.overnight.avgSortino)} day={fmt(summary.daytime.avgSortino)} bh="—" />
                    <AnnualRow label="Avg Calmar Ratio" ovn={fmt(summary.overnight.avgCalmar)} day={fmt(summary.daytime.avgCalmar)} bh="—" />
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Panel 2: Trade Performance (Paper Tables 3/4) ── */}
            <div className="bg-surface/50 border border-border/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider">Trade Performance Analysis (Paper Table 3 & 4)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/20">
                    <tr>
                      <th className="px-4 py-2 text-left">Metric</th>
                      <th className="px-4 py-2 text-right text-green-400">Overnight</th>
                      <th className="px-4 py-2 text-right text-red-400">Daytime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    <TradeRow label="Total Trades" ovn={summary.overnight.totalTrades.toLocaleString()} day={summary.daytime.totalTrades.toLocaleString()} />
                    <TradeRow label="Winner Trades" ovn={summary.overnight.totalWins.toLocaleString()} day={summary.daytime.totalWins.toLocaleString()} />
                    <TradeRow label="Loser Trades" ovn={summary.overnight.totalLosses.toLocaleString()} day={summary.daytime.totalLosses.toLocaleString()} />
                    <TradeRow label="Avg Win Rate" ovn={`${fmt(summary.overnight.avgWinRate)}%`} day={`${fmt(summary.daytime.avgWinRate)}%`} />
                    <TradeRow label="Gross Profit" ovn={`$${summary.overnight.totalGrossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} day={`$${summary.daytime.totalGrossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                    <TradeRow label="Gross Loss" ovn={`-$${summary.overnight.totalGrossLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} day={`-$${summary.daytime.totalGrossLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                    <TradeRow label="Net Profit (with commission)" ovn={`$${summary.overnight.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} day={`$${summary.daytime.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} highlight />
                    <TradeRow label="Avg Profit Factor" ovn={fmt(summary.overnight.avgProfitFactor)} day={fmt(summary.daytime.avgProfitFactor)} />
                    <TradeRow label="Avg Max Drawdown" ovn={`${fmt(summary.overnight.avgMaxDrawdown)}%`} day={`${fmt(summary.daytime.avgMaxDrawdown)}%`} />
                    <TradeRow label="Portfolio Max Drawdown" ovn={`${fmt(summary.overnight.portfolioMaxDrawdownPct)}%`} day={`${fmt(summary.daytime.portfolioMaxDrawdownPct)}%`} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Panel 3: Portfolio Overview Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard label="Stocks Tested" value={`${summary.successfulStocks} / ${summary.totalStocks}`} />
              <MetricCard label="O/N Profitable" value={`${summary.positiveStocksOvernight}`} tone="bull" />
              <MetricCard label="O/N Losing" value={`${summary.negativeStocksOvernight}`} tone="bear" />
              <MetricCard label="Day Profitable" value={`${summary.positiveStocksDaytime}`} tone="bull" />
              <MetricCard label="Day Losing" value={`${summary.negativeStocksDaytime}`} tone="bear" />
              <MetricCard label="Failed Fetches" value={`${summary.failedStocks}`} tone={summary.failedStocks > 0 ? "bear" : undefined} />
              {summary.bestOvernightStock && <MetricCard label="Best O/N Stock" value={`${summary.bestOvernightStock.symbol} (${fmt(summary.bestOvernightStock.returnPct)}%)`} tone="bull" />}
              {summary.worstOvernightStock && <MetricCard label="Worst O/N Stock" value={`${summary.worstOvernightStock.symbol} (${fmt(summary.worstOvernightStock.returnPct)}%)`} tone="bear" />}
              {summary.bestDaytimeStock && <MetricCard label="Best Day Stock" value={`${summary.bestDaytimeStock.symbol} (${fmt(summary.bestDaytimeStock.returnPct)}%)`} tone="bull" />}
              {summary.worstDaytimeStock && <MetricCard label="Worst Day Stock" value={`${summary.worstDaytimeStock.symbol} (${fmt(summary.worstDaytimeStock.returnPct)}%)`} tone="bear" />}
            </div>

            {/* ── Region Breakdown ── */}
            {summary.regionBreakdown.length > 0 && (
              <div className="bg-surface/50 border border-border/50 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Region Breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/20">
                      <tr>
                        <th className="px-4 py-2 text-left">Region</th>
                        <th className="px-4 py-2 text-right">Stocks</th>
                        <th className="px-4 py-2 text-right">O/N Profitable</th>
                        <th className="px-4 py-2 text-right">O/N Profitable %</th>
                        <th className="px-4 py-2 text-right">Day Profitable</th>
                        <th className="px-4 py-2 text-right">Day Profitable %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {summary.regionBreakdown.map(r => (
                        <tr key={r.region} className="hover:bg-surface-2/30">
                          <td className="px-4 py-2 font-medium">{r.region}</td>
                          <td className="px-4 py-2 text-right">{r.count}</td>
                          <td className="px-4 py-2 text-right text-bull">{r.overnightProfitable}</td>
                          <td className="px-4 py-2 text-right text-bull">{(r.overnightProfitable / r.count * 100).toFixed(0)}%</td>
                          <td className="px-4 py-2 text-right text-bear">{r.daytimeProfitable}</td>
                          <td className="px-4 py-2 text-right text-bear">{(r.daytimeProfitable / r.count * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Aggregate Equity Curve ── */}
            <div className="bg-surface/50 border border-border/50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Aggregate Portfolio Equity (Overnight vs Daytime vs Buy & Hold)
              </h3>
              <div className="flex gap-4 mb-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 rounded" />Overnight</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded" />Daytime</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded" />Buy & Hold</span>
              </div>
              <div ref={aggChartRef} className="w-full h-[350px]" />
            </div>

            {/* ── Individual Stock Chart ── */}
            {selectedSymbol && (
              <div className="bg-surface/50 border border-border/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    {selectedSymbol} — Equity Curve
                    {loadingStock && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  </h3>
                  <button onClick={() => setSelectedSymbol(null)}
                    className="p-1 hover:bg-surface-2 rounded text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-4 mb-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 rounded" />Overnight</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded" />Daytime</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded" />Buy & Hold</span>
                </div>
                <div ref={stockChartRef} className="w-full h-[300px]" />
                {/* Per-stock metrics panel */}
                {(() => {
                  const r = summary.results.find(x => x.symbol === selectedSymbol);
                  if (!r || r.error) return null;
                  return (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[10px]">
                      <MiniMetric label="O/N Return" value={`${fmt(r.overnight.totalReturnPct)}%`} tone={r.overnight.totalReturnPct >= 0 ? "bull" : "bear"} />
                      <MiniMetric label="O/N Sharpe" value={fmt(r.overnight.sharpe)} />
                      <MiniMetric label="O/N Max DD" value={`${fmt(r.overnight.maxDrawdownPct)}%`} tone="bear" />
                      <MiniMetric label="O/N Win Rate" value={`${fmt(r.overnight.winRate)}%`} />
                      <MiniMetric label="O/N Net P&L" value={`$${r.overnight.netProfit.toFixed(0)}`} tone={r.overnight.netProfit >= 0 ? "bull" : "bear"} />
                      <MiniMetric label="O/N Sortino" value={fmt(r.overnight.sortinoRatio)} />
                      <MiniMetric label="Day Return" value={`${fmt(r.daytime.totalReturnPct)}%`} tone={r.daytime.totalReturnPct >= 0 ? "bull" : "bear"} />
                      <MiniMetric label="Day Sharpe" value={fmt(r.daytime.sharpe)} />
                      <MiniMetric label="Day Max DD" value={`${fmt(r.daytime.maxDrawdownPct)}%`} tone="bear" />
                      <MiniMetric label="Day Win Rate" value={`${fmt(r.daytime.winRate)}%`} />
                      <MiniMetric label="Day Net P&L" value={`$${r.daytime.netProfit.toFixed(0)}`} tone={r.daytime.netProfit >= 0 ? "bull" : "bear"} />
                      <MiniMetric label="Buy & Hold" value={`${fmt(r.buyHoldReturnPct)}%`} tone={r.buyHoldReturnPct >= 0 ? "bull" : "bear"} />
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Results Table ── */}
            <div className="border border-border/60 rounded-lg bg-surface/40 overflow-hidden">
              <div className="flex items-center px-4 h-9 border-b border-border/60 bg-surface-2/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Globe className="w-3.5 h-3.5 mr-2" />
                <span>{filteredResults.length} stocks · Click a row to view equity curve</span>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/30 sticky top-0 z-[5]">
                    <tr>
                      <SortHeader label="Symbol" col="symbol" current={sortKey} dir={sortDir} onClick={toggleSort} sticky />
                      <SortHeader label="Region" col="region" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Return" col="o_totalReturnPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Net P&L" col="o_netProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Wins" col="o_wins" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Losses" col="o_losses" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N WR" col="o_winRate" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Sharpe" col="o_sharpe" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Max DD" col="o_maxDrawdownPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N PF" col="o_profitFactor" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Ann%" col="o_annualizedReturnPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N σ" col="o_annualStdDev" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="O/N Sortino" col="o_sortinoRatio" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day Return" col="d_totalReturnPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day P&L" col="d_netProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day Wins" col="d_wins" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day Losses" col="d_losses" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day WR" col="d_winRate" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day Sharpe" col="d_sharpe" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Day Max DD" col="d_maxDrawdownPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Buy&Hold" col="buyHoldReturnPct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map(r => {
                      const oUp = r.overnight.totalReturnPct >= 0;
                      const dUp = r.daytime.totalReturnPct >= 0;
                      return (
                        <tr key={r.symbol} onClick={() => setSelectedSymbol(r.symbol)}
                          className={cn("border-t border-border/30 hover:bg-surface-2/40 cursor-pointer transition-colors",
                            selectedSymbol === r.symbol && "bg-primary/5 border-l-2 border-l-primary")}>
                          <td className="px-3 py-2 sticky left-0 bg-surface/90 z-[2]">
                            <div className="font-semibold text-foreground">{r.symbol}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{r.name}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase",
                              r.region === "US" && "bg-blue-500/10 text-blue-400",
                              r.region === "Europe" && "bg-purple-500/10 text-purple-400",
                              r.region === "Asia" && "bg-amber-500/10 text-amber-400",
                              r.region === "ETF & Leveraged" && "bg-cyan-500/10 text-cyan-400",
                            )}>{r.region}</span>
                          </td>
                          {/* Overnight columns */}
                          <td className={cn("px-3 py-2 text-right font-medium", oUp ? "text-bull" : "text-bear")}>{oUp ? "+" : ""}{fmt(r.overnight.totalReturnPct)}%</td>
                          <td className={cn("px-3 py-2 text-right font-mono", r.overnight.netProfit >= 0 ? "text-bull" : "text-bear")}>${r.overnight.netProfit.toFixed(0)}</td>
                          <td className="px-3 py-2 text-right">{r.overnight.wins}</td>
                          <td className="px-3 py-2 text-right">{r.overnight.losses}</td>
                          <td className="px-3 py-2 text-right">{fmt(r.overnight.winRate)}%</td>
                          <td className={cn("px-3 py-2 text-right", r.overnight.sharpe >= 0 ? "text-foreground" : "text-bear")}>{fmt(r.overnight.sharpe)}</td>
                          <td className="px-3 py-2 text-right text-bear">{fmt(r.overnight.maxDrawdownPct)}%</td>
                          <td className="px-3 py-2 text-right">{r.overnight.profitFactor >= 999 ? "∞" : fmt(r.overnight.profitFactor)}</td>
                          <td className={cn("px-3 py-2 text-right", r.overnight.annualizedReturnPct >= 0 ? "text-bull" : "text-bear")}>{fmt(r.overnight.annualizedReturnPct)}%</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.overnight.annualStdDev)}%</td>
                          <td className="px-3 py-2 text-right">{fmt(r.overnight.sortinoRatio)}</td>
                          {/* Daytime columns */}
                          <td className={cn("px-3 py-2 text-right font-medium", dUp ? "text-bull" : "text-bear")}>{dUp ? "+" : ""}{fmt(r.daytime.totalReturnPct)}%</td>
                          <td className={cn("px-3 py-2 text-right font-mono", r.daytime.netProfit >= 0 ? "text-bull" : "text-bear")}>${r.daytime.netProfit.toFixed(0)}</td>
                          <td className="px-3 py-2 text-right">{r.daytime.wins}</td>
                          <td className="px-3 py-2 text-right">{r.daytime.losses}</td>
                          <td className="px-3 py-2 text-right">{fmt(r.daytime.winRate)}%</td>
                          <td className={cn("px-3 py-2 text-right", r.daytime.sharpe >= 0 ? "text-foreground" : "text-bear")}>{fmt(r.daytime.sharpe)}</td>
                          <td className="px-3 py-2 text-right text-bear">{fmt(r.daytime.maxDrawdownPct)}%</td>
                          {/* Buy & Hold */}
                          <td className={cn("px-3 py-2 text-right", r.buyHoldReturnPct >= 0 ? "text-bull/60" : "text-bear/60")}>{r.buyHoldReturnPct >= 0 ? "+" : ""}{fmt(r.buyHoldReturnPct)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* ── Totals Footer ── */}
                  <tfoot className="bg-surface-2 border-t-2 border-border font-medium sticky bottom-0 z-[5]">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right font-semibold sticky left-0 bg-surface-2 z-[2]">Portfolio Total / Average</td>
                      <td className={cn("px-3 py-2 text-right", summary.overnight.avgTotalReturn >= 0 ? "text-bull" : "text-bear")}>{fmt(summary.overnight.avgTotalReturn)}%</td>
                      <td className={cn("px-3 py-2 text-right font-mono", summary.overnight.totalPnL >= 0 ? "text-bull" : "text-bear")}>${summary.overnight.totalPnL.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right">{summary.overnight.totalWins}</td>
                      <td className="px-3 py-2 text-right">{summary.overnight.totalLosses}</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.overnight.avgWinRate)}%</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.overnight.avgSharpe)}</td>
                      <td className="px-3 py-2 text-right text-bear">{fmt(summary.overnight.avgMaxDrawdown)}%</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.overnight.avgProfitFactor)}</td>
                      <td className={cn("px-3 py-2 text-right", summary.overnight.avgAnnualReturn >= 0 ? "text-bull" : "text-bear")}>{fmt(summary.overnight.avgAnnualReturn)}%</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmt(summary.overnight.avgAnnualStdDev)}%</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.overnight.avgSortino)}</td>
                      <td className={cn("px-3 py-2 text-right", summary.daytime.avgTotalReturn >= 0 ? "text-bull" : "text-bear")}>{fmt(summary.daytime.avgTotalReturn)}%</td>
                      <td className={cn("px-3 py-2 text-right font-mono", summary.daytime.totalPnL >= 0 ? "text-bull" : "text-bear")}>${summary.daytime.totalPnL.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right">{summary.daytime.totalWins}</td>
                      <td className="px-3 py-2 text-right">{summary.daytime.totalLosses}</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.daytime.avgWinRate)}%</td>
                      <td className="px-3 py-2 text-right">{fmt(summary.daytime.avgSharpe)}</td>
                      <td className="px-3 py-2 text-right text-bear">{fmt(summary.daytime.avgMaxDrawdown)}%</td>
                      <td className={cn("px-3 py-2 text-right", summary.avgBuyHoldReturn >= 0 ? "text-bull/60" : "text-bear/60")}>{fmt(summary.avgBuyHoldReturn)}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!summary && !running && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Moon className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Overnight Return Temporal Market Anomaly</h2>
            <p className="text-sm text-muted-foreground max-w-lg mb-6">
              Test whether buying stocks at market close and selling at the next day's open generates
              consistent alpha across 200+ globally diversified stocks. Based on the research paper by Basdekidou (2017).
            </p>
            <button onClick={run}
              className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Play className="w-4 h-4" /> Run Backtest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

// ─── Sub-components ──────────────────────────────────────────

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="border border-border/60 rounded-md p-3 bg-surface/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular mt-0.5",
        tone === "bull" && "text-bull", tone === "bear" && "text-bear",
      )}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="bg-surface-2/40 rounded px-2 py-1.5">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-mono font-medium mt-0.5",
        tone === "bull" && "text-bull", tone === "bear" && "text-bear",
      )}>{value}</div>
    </div>
  );
}

function AnnualRow({ label, ovn, day, bh }: { label: string; ovn: string; day: string; bh: string }) {
  return (
    <tr className="hover:bg-surface-2/30">
      <td className="px-4 py-2.5 text-muted-foreground font-medium">{label}</td>
      <td className="px-4 py-2.5 text-right font-mono text-green-400">{ovn}</td>
      <td className="px-4 py-2.5 text-right font-mono text-red-400">{day}</td>
      <td className="px-4 py-2.5 text-right font-mono text-indigo-400">{bh}</td>
    </tr>
  );
}

function TradeRow({ label, ovn, day, highlight }: { label: string; ovn: string; day: string; highlight?: boolean }) {
  return (
    <tr className={cn("hover:bg-surface-2/30", highlight && "bg-primary/5")}>
      <td className={cn("px-4 py-2.5 font-medium", highlight ? "text-foreground" : "text-muted-foreground")}>{label}</td>
      <td className={cn("px-4 py-2.5 text-right font-mono", highlight ? "text-green-400 font-semibold" : "text-green-400/80")}>{ovn}</td>
      <td className={cn("px-4 py-2.5 text-right font-mono", highlight ? "text-red-400 font-semibold" : "text-red-400/80")}>{day}</td>
    </tr>
  );
}

function SortHeader({ label, col, current, dir, onClick, sticky }: {
  label: string; col: SortKey; current: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void; sticky?: boolean;
}) {
  const active = current === col;
  return (
    <th className={cn("text-left px-3 py-2 cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap",
      sticky && "sticky left-0 bg-surface-2/80 z-[3]")}
      onClick={() => onClick(col)}>
      <span className="flex items-center gap-1">
        {label}
        {active && (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}
