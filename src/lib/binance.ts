export type Interval =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h"
  | "1d" | "1w" | "1M";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const REST = "https://api.binance.com";
const WS = "wss://stream.binance.com:9443/ws";

export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit = 500,
): Promise<Candle[]> {
  const url = `${REST}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  const rows = (await r.json()) as unknown[][];
  return rows.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}

export async function fetchTickers(symbols: string[]): Promise<Ticker24h[]> {
  const q = encodeURIComponent(JSON.stringify(symbols.map((s) => s.toUpperCase())));
  const r = await fetch(`${REST}/api/v3/ticker/24hr?symbols=${q}`);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  const rows = (await r.json()) as Array<Record<string, string>>;
  return rows.map((t) => ({
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChangePercent: parseFloat(t.priceChangePercent),
    quoteVolume: parseFloat(t.quoteVolume),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
  }));
}

export function subscribeKline(
  symbol: string,
  interval: Interval,
  onCandle: (c: Candle) => void,
): () => void {
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;
  const ws = new WebSocket(`${WS}/${stream}`);
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const k = msg.k;
      if (!k) return;
      onCandle({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      });
    } catch {
      /* ignore */
    }
  };
  return () => {
    try { ws.close(); } catch { /* noop */ }
  };
}

export function subscribeTickers(
  symbols: string[],
  onTick: (t: { symbol: string; price: number; changePct: number }) => void,
): () => void {
  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
  ws.onmessage = (ev) => {
    try {
      const { data } = JSON.parse(ev.data);
      if (!data) return;
      onTick({
        symbol: data.s,
        price: parseFloat(data.c),
        changePct: parseFloat(data.P),
      });
    } catch { /* ignore */ }
  };
  return () => { try { ws.close(); } catch { /* noop */ } };
}
