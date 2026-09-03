import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSchedules, saveSchedule, deleteSchedule, listRuns } from "@/lib/schedules.functions";
import { listStrategies } from "@/lib/strategies.functions";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({ meta: [{ title: "Scheduled Backtests — QuantDesk" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listSchedules);
  const save = useServerFn(saveSchedule);
  const del = useServerFn(deleteSchedule);
  const runs = useServerFn(listRuns);
  const strats = useServerFn(listStrategies);

  const [rows, setRows] = useState<any[]>([]);
  const [runsRows, setRuns] = useState<any[]>([]);
  const [ss, setSS] = useState<any[]>([]);
  const [cadence, setCadence] = useState(60);
  const [strategyId, setStrategyId] = useState<string>("");

  const refresh = async () => {
    const [a, r, s] = await Promise.all([list(), runs(), strats()]);
    setRows(a as any[]);
    setRuns(r as any[]);
    setSS(s as any[]);
    if (!strategyId && (s as any[]).length) setStrategyId((s as any[])[0].id);
  };
  useEffect(() => { void refresh(); }, []);

  const add = async () => {
    const s = ss.find((x) => x.id === strategyId);
    if (!s) return toast.error("Select a strategy first");
    await save({ data: { strategy_id: s.id, symbol: s.symbol, interval: s.interval, cadence_minutes: cadence, enabled: true } });
    toast.success("Schedule created");
    void refresh();
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Clock className="w-5 h-5" /> Scheduled Backtests</h1>
        </div>

        <section className="border border-border/60 rounded-md bg-surface/40 p-4 space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Add schedule</h2>
          <div className="flex items-center gap-2">
            <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}
              className="bg-input border border-border rounded px-2 py-1.5 text-sm flex-1">
              {ss.length === 0 && <option value="">— No saved strategies —</option>}
              {ss.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.symbol} · {s.interval}</option>)}
            </select>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              Every
              <input type="number" min={1} value={cadence} onChange={(e) => setCadence(Number(e.target.value))}
                className="w-16 bg-input border border-border rounded px-2 py-1 text-sm tabular" />
              min
            </label>
            <button onClick={add} disabled={!strategyId}
              className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
              Add
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Schedules</h2>
          <div className="border border-border/60 rounded-md bg-surface/40">
            {rows.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No schedules yet.</div> : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50">
                  <tr>
                    <th className="text-left px-4 py-2">Strategy</th>
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-left px-4 py-2">Cadence</th>
                    <th className="text-left px-4 py-2">Last run</th>
                    <th /><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-4 py-2 font-medium">{r.strategies?.name ?? "—"}</td>
                      <td className="px-4 py-2 tabular text-muted-foreground">{r.symbol} · {r.interval}</td>
                      <td className="px-4 py-2 tabular text-muted-foreground">every {r.cadence_minutes}m</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2">
                        <button onClick={async () => { await save({ data: { id: r.id, strategy_id: r.strategy_id, symbol: r.symbol, interval: r.interval, cadence_minutes: r.cadence_minutes, enabled: !r.enabled } }); refresh(); }}
                          className={`h-6 px-2 rounded text-[10px] ${r.enabled ? "bg-bull/20 text-bull" : "bg-surface-2 text-muted-foreground"}`}>
                          {r.enabled ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={async () => { if (confirm("Delete schedule?")) { await del({ data: { id: r.id } }); refresh(); } }}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-bear" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent runs</h2>
          <div className="border border-border/60 rounded-md bg-surface/40 max-h-80 overflow-y-auto">
            {runsRows.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No runs yet.</div> : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Strategy</th>
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-right px-4 py-2">Return</th>
                    <th className="text-right px-4 py-2">Sharpe</th>
                    <th className="text-right px-4 py-2">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {runsRows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-4 py-2 text-muted-foreground">{new Date(r.ran_at).toLocaleString()}</td>
                      <td className="px-4 py-2">{r.strategies?.name ?? "—"}</td>
                      <td className="px-4 py-2 tabular text-muted-foreground">{r.symbol} · {r.interval}</td>
                      <td className={`px-4 py-2 text-right tabular ${r.metrics?.totalReturnPct >= 0 ? "text-bull" : "text-bear"}`}>
                        {Number(r.metrics?.totalReturnPct ?? 0).toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right tabular">{Number(r.metrics?.sharpe ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular">{r.metrics?.trades ?? 0}</td>
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
