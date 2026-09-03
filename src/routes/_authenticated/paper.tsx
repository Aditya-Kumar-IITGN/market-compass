import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPaperState, placePaperOrder, createBot, toggleBot, deleteBot } from "@/lib/paper.functions";
import { listStrategies } from "@/lib/strategies.functions";
import { toast } from "sonner";
import { ArrowLeft, Bot, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/paper")({
  head: () => ({ meta: [{ title: "Paper Trading — QuantDesk" }] }),
  component: Page,
});

type State = {
  account: { id: string; name: string; cash: number };
  orders: any[]; positions: any[]; bots: any[];
};

function Page() {
  const getState = useServerFn(getPaperState);
  const place = useServerFn(placePaperOrder);
  const listStrats = useServerFn(listStrategies);
  const addBot = useServerFn(createBot);
  const tglBot = useServerFn(toggleBot);
  const rmBot = useServerFn(deleteBot);

  const [state, setState] = useState<State | null>(null);
  const [strats, setStrats] = useState<{ id: string; name: string; symbol: string; interval: string }[]>([]);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [qty, setQty] = useState(0.01);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const refresh = async () => {
    const [s, ss] = await Promise.all([getState(), listStrats()]);
    setState(s as State);
    setStrats(ss as any);
  };
  useEffect(() => { void refresh(); }, []);

  const submit = async () => {
    try {
      await place({ data: { symbol: symbol.toUpperCase(), side, qty } });
      toast.success(`${side.toUpperCase()} ${qty} ${symbol}`);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Order failed"); }
  };

  const spawnBot = async (strategyId: string) => {
    const s = strats.find((x) => x.id === strategyId)!;
    await addBot({ data: { strategy_id: s.id, symbol: s.symbol, interval: s.interval } });
    toast.success("Bot created");
    await refresh();
  };

  if (!state) return <div className="dark min-h-screen bg-background text-foreground p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-xl font-semibold">Paper Trading</h1>
          <div className="ml-auto flex items-center gap-4 text-sm tabular">
            <span className="text-muted-foreground">Cash</span>
            <span className="font-semibold">${Number(state.account.cash).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="border border-border/60 rounded-md bg-surface/40 p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Place order (market)</h2>
            <div className="flex items-center gap-2">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)}
                className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-sm tabular uppercase" />
              <select value={side} onChange={(e) => setSide(e.target.value as any)}
                className="bg-input border border-border rounded px-2 py-1.5 text-sm">
                <option value="buy">Buy</option><option value="sell">Sell</option>
              </select>
              <input type="number" step="0.0001" value={qty} onChange={(e) => setQty(Number(e.target.value))}
                className="w-28 bg-input border border-border rounded px-2 py-1.5 text-sm tabular" />
              <button onClick={submit}
                className={`h-8 px-3 rounded text-xs font-medium ${side === "buy" ? "bg-bull text-white" : "bg-bear text-white"}`}>
                {side === "buy" ? "Buy" : "Sell"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Fills instantly at the latest 1m close from Binance.</p>
          </section>

          <section className="border border-border/60 rounded-md bg-surface/40 p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bot className="w-4 h-4" /> Auto bots
            </h2>
            {strats.length === 0 ? (
              <p className="text-xs text-muted-foreground">Save a strategy first to launch a bot.</p>
            ) : (
              <select onChange={(e) => e.target.value && spawnBot(e.target.value)} defaultValue=""
                className="bg-input border border-border rounded px-2 py-1.5 text-sm w-full">
                <option value="" disabled>Attach a saved strategy…</option>
                {strats.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.symbol} · {s.interval}</option>)}
              </select>
            )}
            <ul className="space-y-1.5">
              {state.bots.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-xs">
                  <span className="tabular">{b.symbol}</span>
                  <span className="text-muted-foreground">{b.interval}</span>
                  <button onClick={async () => { await tglBot({ data: { id: b.id, enabled: !b.enabled } }); refresh(); }}
                    className={`ml-auto h-5 px-2 rounded text-[10px] ${b.enabled ? "bg-bull/20 text-bull" : "bg-surface-2 text-muted-foreground"}`}>
                    {b.enabled ? "ON" : "OFF"}
                  </button>
                  <button onClick={async () => { if (confirm("Remove bot?")) { await rmBot({ data: { id: b.id } }); refresh(); } }}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-bear" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Positions</h2>
          <div className="border border-border/60 rounded-md bg-surface/40">
            {state.positions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No open positions.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50">
                  <tr><th className="text-left px-4 py-2">Symbol</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Avg Price</th></tr>
                </thead>
                <tbody>
                  {state.positions.map((p) => (
                    <tr key={p.id} className="border-t border-border/40">
                      <td className="px-4 py-2 font-medium tabular">{p.symbol}</td>
                      <td className="px-4 py-2 text-right tabular">{Number(p.qty)}</td>
                      <td className="px-4 py-2 text-right tabular">{Number(p.avg_price).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Order history</h2>
          <div className="border border-border/60 rounded-md bg-surface/40 max-h-96 overflow-y-auto">
            {state.orders.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No orders yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-left px-4 py-2">Side</th>
                    <th className="text-right px-4 py-2">Qty</th>
                    <th className="text-right px-4 py-2">Price</th>
                    <th className="text-left px-4 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map((o) => (
                    <tr key={o.id} className="border-t border-border/40">
                      <td className="px-4 py-2 text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 tabular">{o.symbol}</td>
                      <td className={`px-4 py-2 uppercase text-xs ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                      <td className="px-4 py-2 text-right tabular">{Number(o.qty)}</td>
                      <td className="px-4 py-2 text-right tabular">{Number(o.price).toFixed(4)}</td>
                      <td className="px-4 py-2 text-[10px] uppercase text-muted-foreground">{o.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
