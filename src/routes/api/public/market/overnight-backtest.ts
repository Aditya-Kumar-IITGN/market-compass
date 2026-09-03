import { createFileRoute } from "@tanstack/react-router";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();
import { STOCK_UNIVERSE, type StockEntry } from "@/lib/stock-universe";
import {
  runOvernightBacktest,
  aggregateResults,
  type OvernightResult,
  type OvernightSummary,
} from "@/lib/overnight-backtest";

const BATCH_SIZE = 5;
const DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDailyCandles(symbol: string) {
  const now = new Date();
  const period1 = new Date();
  period1.setFullYear(now.getFullYear() - 2);

  const res: any = await yahooFinance.historical(symbol, {
    period1,
    period2: now,
    interval: "1d" as any,
  });

  return res.map((k: any) => ({
    time: Math.floor(k.date.getTime() / 1000),
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close ?? k.adjClose,
    volume: k.volume,
  }));
}

export const Route = createFileRoute("/api/public/market/overnight-backtest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          initialCapital?: number;
          feeModel?: "bps" | "per_share";
          feeValue?: number;
          compoundMode?: boolean;
          symbols?: string[];
        } = {};
        try {
          body = await request.json();
        } catch {
          // use defaults
        }

        const initialCapital = body.initialCapital ?? 100000;
        const feeModel = body.feeModel ?? "per_share";
        const feeValue = body.feeValue ?? 0.01;
        const compoundMode = body.compoundMode ?? true;

        // Use custom symbols or default universe
        let stocks: StockEntry[];
        if (body.symbols && body.symbols.length > 0) {
          stocks = body.symbols.map((s) => {
            const found = STOCK_UNIVERSE.find((u) => u.symbol === s);
            return found ?? { symbol: s, name: s, region: "Other" as const };
          });
        } else {
          stocks = [...STOCK_UNIVERSE];
        }

        const results: OvernightResult[] = [];

        // Process in batches to avoid rate limits
        for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
          const batch = stocks.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.allSettled(
            batch.map(async (stock) => {
              try {
                const candles = await fetchDailyCandles(stock.symbol);
                return runOvernightBacktest(
                  stock.symbol,
                  stock.name,
                  stock.region,
                  candles,
                  initialCapital,
                  feeModel,
                  feeValue,
                  compoundMode,
                );
              } catch (err) {
                console.error(`Failed to backtest ${stock.symbol}:`, err);
                return {
                  symbol: stock.symbol,
                  name: stock.name,
                  region: stock.region,
                  error: err instanceof Error ? err.message : "Unknown error",
                  overnight: {
                    totalReturnPct: 0, annualizedReturnPct: 0, annualStdDev: 0,
                    sharpe: 0, sortinoRatio: 0, calmarRatio: 0,
                    winRate: 0, wins: 0, losses: 0, totalTrades: 0,
                    avgReturnPct: 0, medianReturnPct: 0, avgWinPct: 0, avgLossPct: 0,
                    bestTradePct: 0, worstTradePct: 0,
                    grossProfit: 0, grossLoss: 0, netProfit: 0, profitFactor: 0,
                    maxDrawdownPct: 0, finalEquity: 0,
                    consecutiveWins: 0, consecutiveLosses: 0,
                  },
                  daytime: {
                    totalReturnPct: 0, annualizedReturnPct: 0, annualStdDev: 0,
                    sharpe: 0, sortinoRatio: 0, calmarRatio: 0,
                    winRate: 0, wins: 0, losses: 0, totalTrades: 0,
                    avgReturnPct: 0, medianReturnPct: 0, avgWinPct: 0, avgLossPct: 0,
                    bestTradePct: 0, worstTradePct: 0,
                    grossProfit: 0, grossLoss: 0, netProfit: 0, profitFactor: 0,
                    maxDrawdownPct: 0, finalEquity: 0,
                    consecutiveWins: 0, consecutiveLosses: 0,
                  },
                  equity: [], daytimeEquity: [], buyHoldEquity: [],
                  buyHoldReturnPct: 0,
                } satisfies OvernightResult;
              }
            }),
          );

          for (const r of batchResults) {
            if (r.status === "fulfilled") {
              results.push(r.value);
            }
          }

          // Delay between batches
          if (i + BATCH_SIZE < stocks.length) {
            await sleep(DELAY_MS);
          }
        }

        const summary: OvernightSummary = aggregateResults(results);

        // Strip equity curves from per-stock results to keep payload smaller
        const lightResults = summary.results.map(({ equity, daytimeEquity, buyHoldEquity, ...rest }) => rest);

        return Response.json({
          ...summary,
          results: lightResults,
        });
      },
    },
  },
});
