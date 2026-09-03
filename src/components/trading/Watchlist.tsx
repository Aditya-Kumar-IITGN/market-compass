import { useEffect, useState } from "react";
import { fetchMarketTickers, subscribeMarketTickers, type Ticker24h, parseSymbol } from "@/lib/market";
import { cn } from "@/lib/utils";

const DEFAULT_SYMBOLS = [
  "binance:BTCUSDT", "binance:ETHUSDT", "binance:SOLUSDT", 
  "yahoo:AAPL", "yahoo:TSLA", "yahoo:NVDA",
  "binance:DOGEUSDT", "binance:AVAXUSDT", "yahoo:MSFT"
];

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

interface Props {
  active: string;
  onSelect: (s: string) => void;
}

export function Watchlist({ active, onSelect }: Props) {
  const [tickers, setTickers] = useState<Record<string, Ticker24h>>({});

  useEffect(() => {
    fetchMarketTickers(DEFAULT_SYMBOLS).then((rows) => {
      const map: Record<string, Ticker24h> = {};
      for (const t of rows) map[t.symbol] = t;
      setTickers(map);
    }).catch(console.error);

    const unsub = subscribeMarketTickers(DEFAULT_SYMBOLS, ({ symbol, price, changePct }) => {
      setTickers((prev) => ({
        ...prev,
        [symbol]: { ...(prev[symbol] ?? { symbol, highPrice: 0, lowPrice: 0, quoteVolume: 0 }),
          lastPrice: price, priceChangePercent: changePct } as Ticker24h,
      }));
    });
    return unsub;
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 flex items-center justify-between">
        <span>Watchlist</span>
        <span className="text-primary/70">Live Markets</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {DEFAULT_SYMBOLS.map((sym) => {
          const t = tickers[sym];
          const up = (t?.priceChangePercent ?? 0) >= 0;
          const isActive = sym === active;
          const { provider, symbol } = parseSymbol(sym);
          const displayName = provider === "binance" ? symbol.replace("USDT", "") : symbol;
          
          return (
            <button
              key={sym}
              onClick={() => onSelect(sym)}
              className={cn(
                "w-full px-3 py-2 flex items-center justify-between text-left border-b border-border/40 transition-colors tabular",
                "hover:bg-surface-2",
                isActive && "bg-surface-2 border-l-2 border-l-primary",
              )}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">{displayName}</span>
                <span className={cn(
                  "text-[10px]",
                  provider === "yahoo" ? "text-blue-500/70" : "text-yellow-500/70"
                )}>
                  {provider === "binance" ? "USDT · Crypto" : "Stock"}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-foreground">{t ? fmtPrice(t.lastPrice) : "—"}</span>
                <span className={cn("text-[10px]", up ? "text-bull" : "text-bear")}>
                  {t ? `${up ? "+" : ""}${t.priceChangePercent.toFixed(2)}%` : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
