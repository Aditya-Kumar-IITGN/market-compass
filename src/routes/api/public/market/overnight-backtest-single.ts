import { createFileRoute } from "@tanstack/react-router";
import YahooFinance from "yahoo-finance2";
import { STOCK_UNIVERSE } from "@/lib/stock-universe";
import { runOvernightBacktest } from "@/lib/overnight-backtest";

const yahooFinance = new YahooFinance();

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

export const Route = createFileRoute("/api/public/market/overnight-backtest-single")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol");
        const initialCapital = Number(url.searchParams.get("initialCapital") || "100000");
        const feeModel = (url.searchParams.get("feeModel") as "bps" | "per_share") || "per_share";
        const feeValue = Number(url.searchParams.get("feeValue") || "0.01");
        const compoundMode = url.searchParams.get("compoundMode") !== "false";

        if (!symbol) {
          return Response.json({ error: "Missing symbol" }, { status: 400 });
        }

        const stock = STOCK_UNIVERSE.find((u) => u.symbol === symbol) ?? { symbol, name: symbol, region: "Other" as const };

        try {
          const candles = await fetchDailyCandles(stock.symbol);
          const result = runOvernightBacktest(
            stock.symbol,
            stock.name,
            stock.region,
            candles,
            initialCapital,
            feeModel,
            feeValue,
            compoundMode,
          );
          
          return Response.json(result);
        } catch (err) {
          console.error(`Failed to backtest ${stock.symbol}:`, err);
          return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
