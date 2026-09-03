import { createFileRoute } from "@tanstack/react-router";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

const intervalMap: Record<string, any> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "60m",
  "1d": "1d",
  "1w": "1wk",
  "1M": "1mo",
};

export const Route = createFileRoute("/api/public/market/klines")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol");
        const interval = url.searchParams.get("interval") || "1d";
        const limit = parseInt(url.searchParams.get("limit") || "500");

        if (!symbol) return Response.json({ error: "Missing symbol" }, { status: 400 });

        const yahooInterval = intervalMap[interval];
        if (!yahooInterval) {
          return Response.json({ error: `Interval ${interval} not supported for Yahoo Finance` }, { status: 400 });
        }

        try {
          // Yahoo finance historical needs period1 and period2
          // For 1m/5m/15m/30m/60m, it's limited to last 7-60 days.
          // Let's just use recent data based on limit
          const now = new Date();
          let period1 = new Date();
          
          if (yahooInterval.includes("m")) {
             period1.setDate(now.getDate() - 5); // 5 days back for minute data
          } else if (yahooInterval === "1d") {
             period1.setFullYear(now.getFullYear() - 2); 
          } else {
             period1.setFullYear(now.getFullYear() - 10);
          }

          const res: any = await yahooFinance.chart(symbol, {
            period1,
            period2: now,
            interval: yahooInterval as any,
          });

          const intervalToSeconds: Record<string, number> = {
            "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600,
            "4h": 14400, "1d": 86400, "1w": 604800, "1M": 2592000
          };
          const seconds = intervalToSeconds[interval] || 86400;

          const merged: any[] = [];
          for (const k of (res.quotes || [])) {
            const t = Math.floor(new Date(k.date).getTime() / 1000);
            // Bucket to the nearest interval to fix Yahoo's unaligned partial last candle
            const bucketedTime = Math.floor(t / seconds) * seconds;

            if (merged.length > 0 && merged[merged.length - 1].time === bucketedTime) {
              const last = merged[merged.length - 1];
              last.high = Math.max(last.high, k.high);
              last.low = Math.min(last.low, k.low);
              last.close = k.close;
              last.volume += k.volume || 0;
            } else {
              merged.push({
                time: bucketedTime,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
                volume: k.volume || 0,
              });
            }
          }

          const rows = merged.slice(-limit);

          return Response.json(rows);
        } catch (error) {
          console.error("Yahoo klines error:", error);
          return Response.json({ error: "Failed to fetch historical data" }, { status: 500 });
        }
      },
    },
  },
});
