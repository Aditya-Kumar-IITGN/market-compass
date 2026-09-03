import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/trading/Header";
import { Watchlist } from "@/components/trading/Watchlist";
import { Chart, type ChartType } from "@/components/trading/Chart";
import { IndicatorsPanel } from "@/components/trading/IndicatorsPanel";
import { StrategyPanel } from "@/components/trading/StrategyPanel";
import { INDICATOR_PRESETS, type IndicatorConfig } from "@/components/trading/types";
import type { Interval } from "@/lib/market";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuantDesk — Charts, Indicators & Strategy Backtesting" },
      { name: "description", content: "Live crypto charts, technical indicators, and a no-code strategy builder with historical backtesting. Search any Binance instrument." },
      { property: "og:title", content: "QuantDesk — Pro Crypto Charts & Backtesting" },
      { property: "og:description", content: "Build strategies visually, backtest them on historical data, and monitor any Binance instrument live." },
    ],
  }),
  component: Desk,
});

function Desk() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("1h");
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => [
    { ...INDICATOR_PRESETS.ema(), period: 20, color: "#22d3ee" },
    { ...INDICATOR_PRESETS.ema(), period: 50, color: "#f59e0b" },
    INDICATOR_PRESETS.rsi(),
  ]);

  return (
    <div className="dark flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        symbol={symbol}
        interval={interval}
        chartType={chartType}
        onSymbol={setSymbol}
        onInterval={setInterval}
        onChartType={setChartType}
        onOpenStrategy={() => setStrategyOpen(true)}
      />
      <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr_300px]">
        <aside className="border-r border-border/60 bg-surface/40 min-h-0">
          <Watchlist active={symbol} onSelect={setSymbol} />
        </aside>
        <main className="min-h-0 min-w-0">
          <Chart
            symbol={symbol}
            interval={interval}
            chartType={chartType}
            indicators={indicators}
          />
        </main>
        <aside className="border-l border-border/60 bg-surface/40 min-h-0">
          <IndicatorsPanel indicators={indicators} onChange={setIndicators} />
        </aside>
      </div>
      {strategyOpen && (
        <StrategyPanel symbol={symbol} interval={interval} onClose={() => setStrategyOpen(false)} />
      )}
    </div>
  );
}
