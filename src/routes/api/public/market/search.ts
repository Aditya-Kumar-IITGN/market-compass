import { createFileRoute } from "@tanstack/react-router";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

export const Route = createFileRoute("/api/public/market/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q") || "";
        if (!q) return Response.json([]);

        try {
          const res: any = await yahooFinance.search(q);
          const formatted = res.quotes
            .filter((q: any) => q.isYahooFinance)
            .map((q: any) => ({
              symbol: q.symbol,
              baseAsset: q.shortname || q.longname || q.symbol,
              quoteAsset: q.quoteType || "EQUITY",
              provider: "yahoo",
            }));
          return Response.json(formatted);
        } catch (error) {
          console.error("Yahoo search error:", error);
          return Response.json({ error: "Failed to search" }, { status: 500 });
        }
      },
    },
  },
});
