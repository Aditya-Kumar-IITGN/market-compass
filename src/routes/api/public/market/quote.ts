import { createFileRoute } from "@tanstack/react-router";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

export const Route = createFileRoute("/api/public/market/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbolsParam = url.searchParams.get("symbols");
        if (!symbolsParam) return Response.json([]);

        const symbols = symbolsParam.split(",");

        try {
          // yahooFinance.quote can accept an array of symbols
          const res = await yahooFinance.quote(symbols);
          const quotes = Array.isArray(res) ? res : [res];

          const formatted = quotes.map((q: any) => ({
            symbol: q.symbol,
            lastPrice: q.regularMarketPrice,
            priceChangePercent: q.regularMarketChangePercent,
            quoteVolume: q.regularMarketVolume,
            highPrice: q.regularMarketDayHigh || q.regularMarketPrice,
            lowPrice: q.regularMarketDayLow || q.regularMarketPrice,
            provider: "yahoo",
          }));

          return Response.json(formatted);
        } catch (error) {
          console.error("Yahoo quote error:", error);
          return Response.json({ error: "Failed to fetch quotes" }, { status: 500 });
        }
      },
    },
  },
});
