export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

let cache: SymbolInfo[] | null = null;
let inflight: Promise<SymbolInfo[]> | null = null;

export async function fetchAllSymbols(): Promise<SymbolInfo[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch("https://api.binance.com/api/v3/exchangeInfo");
    if (!r.ok) throw new Error(`exchangeInfo ${r.status}`);
    const j = (await r.json()) as { symbols: SymbolInfo[] };
    cache = j.symbols
      .filter((s) => s.status === "TRADING")
      .map((s) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        status: s.status,
      }));
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function searchSymbols(all: SymbolInfo[], q: string, limit = 30): SymbolInfo[] {
  const query = q.trim().toUpperCase();
  if (!query) {
    // Prefer USDT majors when empty
    return all.filter((s) => s.quoteAsset === "USDT").slice(0, limit);
  }
  const starts: SymbolInfo[] = [];
  const contains: SymbolInfo[] = [];
  for (const s of all) {
    if (s.symbol.startsWith(query) || s.baseAsset.startsWith(query)) starts.push(s);
    else if (s.symbol.includes(query)) contains.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
