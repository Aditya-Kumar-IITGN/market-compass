import type { Candle, Interval, SymbolInfo, Ticker24h } from "./types";

export async function searchYahoo(q: string): Promise<SymbolInfo[]> {
  const r = await fetch(`/api/public/market/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("Failed to search Yahoo");
  return r.json();
}

export async function fetchYahooKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
  const r = await fetch(`/api/public/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error("Failed to fetch Yahoo klines");
  return r.json();
}

export async function fetchYahooTickers(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const q = encodeURIComponent(symbols.join(","));
  const r = await fetch(`/api/public/market/quote?symbols=${q}`);
  if (!r.ok) throw new Error("Failed to fetch Yahoo quotes");
  return r.json();
}

// Yahoo Finance doesn't have an official free websocket we can easily connect to from the client.
// We'll simulate it by polling the quote endpoint every 3 seconds.
export function subscribeYahooTickers(
  symbols: string[],
  onTick: (t: { symbol: string; price: number; changePct: number }) => void,
): () => void {
  let active = true;

  const poll = async () => {
    if (!active || symbols.length === 0) return;
    try {
      const tickers = await fetchYahooTickers(symbols);
      for (const t of tickers) {
        onTick({
          symbol: t.symbol,
          price: t.lastPrice,
          changePct: t.priceChangePercent,
        });
      }
    } catch {
      // ignore errors in polling
    }
    if (active) setTimeout(poll, 3000);
  };

  poll();

  return () => {
    active = false;
  };
}

export function subscribeYahooKline(
  symbol: string,
  interval: Interval,
  onCandle: (c: Candle) => void,
): () => void {
  let active = true;

  // Poll for the latest kline
  const poll = async () => {
    if (!active) return;
    try {
      const candles = await fetchYahooKlines(symbol, interval, 1);
      if (candles.length > 0) {
        onCandle(candles[candles.length - 1]);
      }
    } catch {
      // ignore errors
    }
    // Poll every 3s
    if (active) setTimeout(poll, 3000);
  };

  poll();

  return () => {
    active = false;
  };
}
