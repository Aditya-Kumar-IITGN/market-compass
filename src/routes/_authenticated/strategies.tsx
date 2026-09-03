import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listStrategies, deleteStrategy } from "@/lib/strategies.functions";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategies")({
  head: () => ({ meta: [{ title: "My Strategies — QuantDesk" }] }),
  component: Page,
});

type Row = { id: string; name: string; symbol: string; interval: string; updated_at: string; definition: unknown };

function Page() {
  const list = useServerFn(listStrategies);
  const del = useServerFn(deleteStrategy);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try { setRows((await list()) as Row[]); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this strategy?")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    void refresh();
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-xl font-semibold">My Strategies</h1>
        </div>
        <div className="border border-border/60 rounded-md bg-surface/40">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No saved strategies yet. Open the Strategy Lab from the header, build one, and hit Save.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Symbol</th>
                  <th className="text-left px-4 py-2">Interval</th>
                  <th className="text-left px-4 py-2">Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-surface-2/30">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 tabular text-muted-foreground">{r.symbol}</td>
                    <td className="px-4 py-2 tabular text-muted-foreground">{r.interval}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-bear p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
