import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAlerts, saveAlert, deleteAlert, listAlertEvents } from "@/lib/alerts.functions";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Bell, Plus } from "lucide-react";
import { defaultAlertRule, type SavedAlert } from "@/lib/alert-shared";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — QuantDesk" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listAlerts);
  const save = useServerFn(saveAlert);
  const del = useServerFn(deleteAlert);
  const events = useServerFn(listAlertEvents);
  const [rows, setRows] = useState<SavedAlert[]>([]);
  const [ev, setEv] = useState<{ id: string; message: string; price: number; fired_at: string }[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const [a, e] = await Promise.all([list(), events({ data: { limit: 20 } })]);
    setRows(a as unknown as SavedAlert[]);
    setEv(e as any);
  };
  useEffect(() => { void refresh(); }, []);

  const quickCreate = async () => {
    setCreating(true);
    try {
      await save({
        data: {
          name: "New alert",
          symbol: "BTCUSDT",
          interval: "1h",
          rule: defaultAlertRule(),
          channels: ["toast"],
          cooldown_sec: 300,
          enabled: true,
        },
      });
      toast.success("Alert created");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  };

  const toggle = async (a: SavedAlert) => {
    await save({ data: { ...a, enabled: !a.enabled } });
    await refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete alert?")) return;
    await del({ data: { id } });
    await refresh();
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Bell className="w-5 h-5" /> Alerts</h1>
          <button
            onClick={quickCreate} disabled={creating}
            className="ml-auto h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> New alert
          </button>
        </div>

        <div className="border border-border/60 rounded-md bg-surface/40">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No alerts yet. Create one to be notified when a rule fires on any symbol.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Symbol</th>
                  <th className="text-left px-4 py-2">Interval</th>
                  <th className="text-left px-4 py-2">Channels</th>
                  <th className="text-left px-4 py-2">Cooldown</th>
                  <th className="text-left px-4 py-2">Last fired</th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-border/40">
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2 tabular text-muted-foreground">{a.symbol}</td>
                    <td className="px-4 py-2 tabular text-muted-foreground">{a.interval}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.channels.join(", ")}</td>
                    <td className="px-4 py-2 text-muted-foreground tabular">{a.cooldown_sec}s</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.last_fired_at ? new Date(a.last_fired_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => toggle(a)}
                        className={`h-6 px-2 rounded text-[10px] ${a.enabled ? "bg-bull/20 text-bull" : "bg-surface-2 text-muted-foreground"}`}>
                        {a.enabled ? "ON" : "OFF"}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-bear p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent events</h2>
          <div className="border border-border/60 rounded-md bg-surface/40">
            {ev.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No events yet.</div>
            ) : (
              <ul className="divide-y divide-border/40">
                {ev.map((e) => (
                  <li key={e.id} className="px-4 py-2 text-sm flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular">{new Date(e.fired_at).toLocaleString()}</span>
                    <span className="flex-1">{e.message}</span>
                    <span className="tabular text-muted-foreground">@ {e.price}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Alerts are evaluated every minute against fresh candles. In-app toasts fire whenever this tab is open;
          background push + email delivery can be added next.
        </p>
      </div>
    </div>
  );
}
