import { fetchKlines as fetchBinanceKlines, fetchTickers as fetchBinanceTickers, subscribeKline as subscribeBinanceKline, subscribeTickers as subscribeBinanceTickers } from "../binance";
import { fetchYahooKlines, fetchYahooTickers, subscribeYahooKline, subscribeYahooTickers } from "./yahoo";
import type { Candle, Interval, Ticker24h } from "./types";

export * from "./types";

/**
 * We use a prefix to identify the provider:
 * e.g., "yahoo:AAPL" or "binance:BTCUSDT"
 * If no prefix is present, it defaults to "binance" for backwards compatibility.
 */

export function parseSymbol(rawSymbol: string): { provider: "binance" | "yahoo"; symbol: string } {
  if (rawSymbol.startsWith("yahoo:")) {
    return { provider: "yahoo", symbol: rawSymbol.replace("yahoo:", "") };
  }
  if (rawSymbol.startsWith("binance:")) {
    return { provider: "binance", symbol: rawSymbol.replace("binance:", "") };
  }
  return { provider: "binance", symbol: rawSymbol }; // default to binance
}

export async function fetchMarketKlines(
  rawSymbol: string,
  interval: Interval,
  limit = 500,
): Promise<Candle[]> {
  const { provider, symbol } = parseSymbol(rawSymbol);
  
  if (provider === "yahoo") {
    return fetchYahooKlines(symbol, interval, limit);
  }
  
  return fetchBinanceKlines(symbol, interval, limit);
}

export async function fetchMarketTickers(rawSymbols: string[]): Promise<Ticker24h[]> {
  const binanceSymbols: string[] = [];
  const yahooSymbols: string[] = [];

  for (const rs of rawSymbols) {
    const { provider, symbol } = parseSymbol(rs);
    if (provider === "yahoo") yahooSymbols.push(symbol);
    else binanceSymbols.push(symbol);
  }

  const promises = [];
  if (binanceSymbols.length > 0) promises.push(fetchBinanceTickers(binanceSymbols).then(res => res.map(t => ({ ...t, symbol: `binance:${t.symbol}`, provider: "binance" as const }))));
  if (yahooSymbols.length > 0) promises.push(fetchYahooTickers(yahooSymbols).then(res => res.map(t => ({ ...t, symbol: `yahoo:${t.symbol}`, provider: "yahoo" as const }))));

  const results = await Promise.all(promises);
  return results.flat();
}

export function subscribeMarketKline(
  rawSymbol: string,
  interval: Interval,
  onCandle: (c: Candle) => void,
): () => void {
  const { provider, symbol } = parseSymbol(rawSymbol);
  
  if (provider === "yahoo") {
    return subscribeYahooKline(symbol, interval, onCandle);
  }
  return subscribeBinanceKline(symbol, interval, onCandle);
}

export function subscribeMarketTickers(
  rawSymbols: string[],
  onTick: (t: { symbol: string; price: number; changePct: number }) => void,
): () => void {
  const binanceSymbols: string[] = [];
  const yahooSymbols: string[] = [];

  for (const rs of rawSymbols) {
    const { provider, symbol } = parseSymbol(rs);
    if (provider === "yahoo") yahooSymbols.push(symbol);
    else binanceSymbols.push(symbol);
  }

  const unsubs: Array<() => void> = [];

  if (binanceSymbols.length > 0) {
    unsubs.push(
      subscribeBinanceTickers(binanceSymbols, (t) => {
        onTick({ ...t, symbol: `binance:${t.symbol.toUpperCase()}` });
      })
    );
  }

  if (yahooSymbols.length > 0) {
    unsubs.push(
      subscribeYahooTickers(yahooSymbols, (t) => {
        onTick({ ...t, symbol: `yahoo:${t.symbol}` });
      })
    );
  }

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
