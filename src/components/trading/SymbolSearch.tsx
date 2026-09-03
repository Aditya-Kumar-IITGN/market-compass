import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { fetchAllSymbols, searchSymbols, type SymbolInfo as BinanceSymbolInfo } from "@/lib/exchangeInfo";
import { searchYahoo } from "@/lib/market/yahoo";
import type { SymbolInfo } from "@/lib/market/types";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (symbol: string) => void;
}

export function SymbolSearch({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<BinanceSymbolInfo[]>([]);
  const [yahooResults, setYahooResults] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || all.length) return;
    setLoading(true);
    fetchAllSymbols()
      .then(setAll)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, all.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(async () => {
      if (q.length < 1) {
        setYahooResults([]);
        return;
      }
      try {
        const res = await searchYahoo(q);
        setYahooResults(res);
      } catch (err) {
        console.error("Yahoo search error:", err);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [q, open]);

  const results = useMemo(() => {
    const binanceMatches = searchSymbols(all, q, 20).map(s => ({
      ...s,
      provider: "binance" as const,
      symbol: `binance:${s.symbol}`
    }));
    const combined = [...binanceMatches, ...yahooResults.map(s => ({ ...s, symbol: `yahoo:${s.symbol}` }))];
    return combined.slice(0, 40);
  }, [all, q, yahooResults]);

  const pick = (s: string) => {
    onSelect(s);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-7 px-2.5 rounded bg-surface-2 border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search symbol…</span>
        <span className="text-[9px] px-1 py-0.5 rounded bg-surface border border-border/60">/</span>
      </button>

      {open && (
        <div className="absolute z-50 top-9 left-0 w-[360px] rounded-md border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 h-9 border-b border-border/60">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="BTC, AAPL, PEPE, any crypto or stock…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pick(results[0].symbol);
                if (e.key === "Escape") setOpen(false);
              }}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {loading && <div className="p-4 text-center text-xs text-muted-foreground">Loading instruments…</div>}
            {!loading && results.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">No matches.</div>
            )}
            {results.map((s) => (
              <button
                key={s.symbol}
                onPointerDown={(e) => {
                  e.preventDefault(); // Prevent input from losing focus immediately
                  pick(s.symbol);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-2 border-b border-border/40",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">
                    {s.baseAsset}
                    {s.provider === "binance" && <span className="text-muted-foreground">/{s.quoteAsset}</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular">{s.symbol.split(":")[1]}</span>
                </div>
                <span className={cn(
                  "text-[10px] uppercase",
                  s.provider === "yahoo" ? "text-blue-500/70" : "text-yellow-500/70"
                )}>
                  {s.provider}
                </span>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/60 bg-surface/40">
            {all.length ? `${all.length.toLocaleString()} instruments · ${results.length} shown` : "…"}
          </div>
        </div>
      )}
    </div>
  );
}
