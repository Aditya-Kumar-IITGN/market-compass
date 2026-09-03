import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Play, Loader2, TrendingUp, TrendingDown, Save, FolderOpen, Download, FileText } from "lucide-react";
import {
  createChart, AreaSeries, LineSeries, type IChartApi, type UTCTimestamp, LineStyle,
} from "lightweight-charts";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Candle, Interval } from "@/lib/market";
import { fetchMarketKlines } from "@/lib/market";
import {
  defaultStrategy, newCondition, runBacktest, KIND_LABELS, OP_LABELS,
  type Condition, type IndicatorKind, type Op, type Operand, type RuleSet,
  type Strategy, type BacktestResult,
} from "@/lib/strategy";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { listStrategies, saveStrategy } from "@/lib/strategies.functions";
import { exportBacktestCsv, openBacktestReport } from "@/lib/export-report";

interface Props {
  symbol: string;
  interval: Interval;
  onClose: () => void;
}

const KINDS: IndicatorKind[] = ["price", "sma", "ema", "wma", "rsi", "value"];
const OPS: Op[] = ["gt", "lt", "crossesAbove", "crossesBelow"];

export function StrategyPanel({ symbol, interval, onClose }: Props) {
  const [strategy, setStrategy] = useState<Strategy>(defaultStrategy);
  const [strategyId, setStrategyId] = useState<string | undefined>();
  const [bars, setBars] = useState(1000);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tab, setTab] = useState<"builder" | "results">("builder");
  const [saved, setSaved] = useState<{ id: string; name: string; definition: unknown; symbol: string; interval: string }[]>([]);
  const [openList, setOpenList] = useState(false);
  const { user } = useSession();
  const listFn = useServerFn(listStrategies);
  const saveFn = useServerFn(saveStrategy);

  useEffect(() => {
    if (!user) return;
    listFn().then((r) => setSaved(r as any)).catch(() => {});
  }, [user, listFn]);

  const run = async () => {
    setRunning(true);
    try {
      const data = await fetchMarketKlines(symbol, interval, Math.min(1000, Math.max(100, bars)));
      setCandles(data);
      const r = runBacktest(strategy, data);
      setResult(r);
      setTab("results");
    } catch (e) {
      console.error(e);
      toast.error("Backtest failed");
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    if (!user) { toast.error("Sign in to save strategies"); return; }
    setSaving(true);
    try {
      const r = await saveFn({
        data: { id: strategyId, name: strategy.name, symbol, interval, definition: strategy },
      }) as any;
      setStrategyId(r.id);
      toast.success("Strategy saved");
      const list = await listFn();
      setSaved(list as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const load = (s: { id: string; name: string; definition: unknown }) => {
    setStrategy(s.definition as Strategy);
    setStrategyId(s.id);
    setOpenList(false);
    toast.success(`Loaded "${s.name}"`);
  };

  const updateRule = (key: "entry" | "exit", patch: Partial<RuleSet>) =>
    setStrategy((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  const updateCond = (key: "entry" | "exit", id: string, patch: Partial<Condition>) =>
    setStrategy((s) => ({
      ...s,
      [key]: {
        ...s[key],
        conditions: s[key].conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    }));

  return (
    <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] rounded-lg border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">
        {/* Head */}
        <div className="flex items-center gap-3 px-4 h-11 border-b border-border/60 bg-surface/60">
          <span className="text-sm font-semibold">Strategy Lab</span>
          <span className="text-xs text-muted-foreground">· {symbol} · {interval}</span>
          <div className="ml-4 flex items-center gap-0.5 bg-surface-2 rounded p-0.5">
            {(["builder", "results"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 h-6 text-xs rounded transition-colors capitalize",
                  tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                disabled={t === "results" && !result}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setOpenList((v) => !v)} disabled={!user}
                title={user ? "Load a saved strategy" : "Sign in to save/load"}
                className="h-7 px-2 rounded bg-surface-2 hover:bg-surface text-xs flex items-center gap-1.5 disabled:opacity-40">
                <FolderOpen className="w-3.5 h-3.5" /> Load
              </button>
              {openList && (
                <div className="absolute right-0 top-8 z-50 w-72 max-h-64 overflow-y-auto rounded border border-border/60 bg-popover shadow-lg text-xs">
                  {saved.length === 0 ? (
                    <div className="p-3 text-muted-foreground">No saved strategies yet.</div>
                  ) : saved.map((s) => (
                    <button key={s.id} onClick={() => load(s)} className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border/40">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.symbol} · {s.interval}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={save} disabled={saving || !user}
              title={user ? "Save strategy" : "Sign in to save"}
              className="h-7 px-2 rounded bg-surface-2 hover:bg-surface text-xs flex items-center gap-1.5 disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            {result && (
              <>
                <button onClick={() => exportBacktestCsv(strategy, symbol, interval, result)}
                  className="h-7 px-2 rounded bg-surface-2 hover:bg-surface text-xs flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => openBacktestReport(strategy, symbol, interval, result)}
                  className="h-7 px-2 rounded bg-surface-2 hover:bg-surface text-xs flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Report
                </button>
              </>
            )}
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              Bars
              <input
                type="number"
                value={bars}
                min={100} max={1000} step={100}
                onChange={(e) => setBars(Number(e.target.value))}
                className="w-16 bg-input border border-border rounded px-1.5 py-0.5 text-[10px] tabular"
              />
            </label>
            <button
              onClick={run}
              disabled={running}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Backtest
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "builder" ? (
            <BuilderView
              strategy={strategy}
              onName={(name) => setStrategy((s) => ({ ...s, name }))}
              onRule={updateRule}
              onCond={updateCond}
              addCond={(key) =>
                setStrategy((s) => ({ ...s, [key]: { ...s[key], conditions: [...s[key].conditions, newCondition()] } }))
              }
              removeCond={(key, id) =>
                setStrategy((s) => ({
                  ...s,
                  [key]: { ...s[key], conditions: s[key].conditions.filter((c) => c.id !== id) },
                }))
              }
              onSettings={(patch) => setStrategy((s) => ({ ...s, ...patch }))}
            />
          ) : (
            <ResultsView result={result} candles={candles} strategy={strategy} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Builder ----------

function BuilderView({
  strategy, onName, onRule, onCond, addCond, removeCond, onSettings,
}: {
  strategy: Strategy;
  onName: (n: string) => void;
  onRule: (k: "entry" | "exit", p: Partial<RuleSet>) => void;
  onCond: (k: "entry" | "exit", id: string, p: Partial<Condition>) => void;
  addCond: (k: "entry" | "exit") => void;
  removeCond: (k: "entry" | "exit", id: string) => void;
  onSettings: (p: Partial<Strategy>) => void;
}) {
  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
        <input
          value={strategy.name}
          onChange={(e) => onName(e.target.value)}
          className="flex-1 max-w-xs bg-input border border-border rounded px-2 py-1 text-sm"
        />
      </div>

      <RuleEditor
        label="Entry (Buy when…)"
        color="text-bull"
        rule={strategy.entry}
        onRule={(p) => onRule("entry", p)}
        onCond={(id, p) => onCond("entry", id, p)}
        onAdd={() => addCond("entry")}
        onRemove={(id) => removeCond("entry", id)}
      />
      <RuleEditor
        label="Exit (Sell when…)"
        color="text-bear"
        rule={strategy.exit}
        onRule={(p) => onRule("exit", p)}
        onCond={(id, p) => onCond("exit", id, p)}
        onAdd={() => addCond("exit")}
        onRemove={(id) => removeCond("exit", id)}
      />

      <div className="border border-border/60 rounded-md p-4 bg-surface/40">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Portfolio & Risk</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <NumField label="Capital ($)" value={strategy.initialCapital} onChange={(v) => onSettings({ initialCapital: v })} step={100} />
          <NumField label="Position %" value={strategy.positionPct} onChange={(v) => onSettings({ positionPct: v })} step={5} />
          <NumField label="Fee (bps)" value={strategy.feeBps} onChange={(v) => onSettings({ feeBps: v })} step={1} />
          <NumField label="Stop Loss (bps)" value={strategy.slBps} onChange={(v) => onSettings({ slBps: v })} step={10} />
          <NumField label="Take Profit (bps)" value={strategy.tpBps} onChange={(v) => onSettings({ tpBps: v })} step={10} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">100 bps = 1%. Set SL/TP to 0 to disable.</p>
      </div>
    </div>
  );
}

function RuleEditor({
  label, color, rule, onRule, onCond, onAdd, onRemove,
}: {
  label: string;
  color: string;
  rule: RuleSet;
  onRule: (p: Partial<RuleSet>) => void;
  onCond: (id: string, p: Partial<Condition>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border border-border/60 rounded-md p-4 bg-surface/40">
      <div className="flex items-center gap-3 mb-3">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", color)}>{label}</span>
        <div className="flex items-center gap-0.5 bg-surface-2 rounded p-0.5">
          {(["AND", "OR"] as const).map((j) => (
            <button
              key={j}
              onClick={() => onRule({ join: j })}
              className={cn(
                "px-2 h-5 text-[10px] rounded",
                rule.join === j ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >{j}</button>
          ))}
        </div>
        <button
          onClick={onAdd}
          className="ml-auto text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Condition
        </button>
      </div>
      <div className="space-y-2">
        {rule.conditions.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">No conditions. Add one to define this rule.</div>
        )}
        {rule.conditions.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 flex-wrap">
            {i > 0 && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground")}>{rule.join}</span>
            )}
            <OperandEditor value={c.left} onChange={(o) => onCond(c.id, { left: o })} />
            <select
              value={c.op}
              onChange={(e) => onCond(c.id, { op: e.target.value as Op })}
              className="bg-input border border-border rounded px-2 py-1 text-xs"
            >
              {OPS.map((o) => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
            </select>
            <OperandEditor value={c.right} onChange={(o) => onCond(c.id, { right: o })} />
            <button onClick={() => onRemove(c.id)} className="text-muted-foreground hover:text-bear p-1 ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperandEditor({ value, onChange }: { value: Operand; onChange: (o: Operand) => void }) {
  const needsPeriod = value.kind === "sma" || value.kind === "ema" || value.kind === "wma" || value.kind === "rsi";
  const needsValue = value.kind === "value";
  return (
    <div className="flex items-center gap-1">
      <select
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as IndicatorKind, period: needsPeriod ? value.period : 14, value: value.value ?? 0 })}
        className="bg-input border border-border rounded px-2 py-1 text-xs"
      >
        {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
      </select>
      {needsPeriod && (
        <input
          type="number"
          value={value.period ?? 14}
          onChange={(e) => onChange({ ...value, period: Number(e.target.value) })}
          className="w-14 bg-input border border-border rounded px-1.5 py-1 text-xs tabular"
        />
      )}
      {needsValue && (
        <input
          type="number"
          value={value.value ?? 0}
          onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
          className="w-20 bg-input border border-border rounded px-1.5 py-1 text-xs tabular"
        />
      )}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-input border border-border rounded px-2 py-1 text-sm tabular"
      />
    </label>
  );
}

// ---------- Results ----------

function ResultsView({ result, candles, strategy }: { result: BacktestResult | null; candles: Candle[]; strategy: Strategy }) {
  if (!result) return <div className="p-10 text-center text-muted-foreground text-sm">Run a backtest to see results.</div>;

  const alpha = result.totalReturnPct - result.buyHoldReturnPct;

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Metric label="Total Return" value={`${result.totalReturnPct.toFixed(2)}%`} tone={result.totalReturnPct >= 0 ? "bull" : "bear"} />
        <Metric label="Buy & Hold" value={`${result.buyHoldReturnPct.toFixed(2)}%`} tone={result.buyHoldReturnPct >= 0 ? "bull" : "bear"} />
        <Metric label="Alpha" value={`${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}%`} tone={alpha >= 0 ? "bull" : "bear"} />
        <Metric label="Max Drawdown" value={`-${result.maxDrawdownPct.toFixed(2)}%`} tone="bear" />
        <Metric label="Sharpe" value={result.sharpe.toFixed(2)} />
        <Metric label="Profit Factor" value={Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"} />
        <Metric label="Trades" value={String(result.trades.length)} />
        <Metric label="Win Rate" value={`${result.winRate.toFixed(1)}%`} tone={result.winRate >= 50 ? "bull" : "bear"} />
        <Metric label="Wins / Losses" value={`${result.wins} / ${result.losses}`} />
        <Metric label="Avg Trade" value={`${result.avgPnlPct.toFixed(2)}%`} tone={result.avgPnlPct >= 0 ? "bull" : "bear"} />
        <Metric label="Exposure" value={`${result.exposurePct.toFixed(1)}%`} />
        <Metric label="Final Equity" value={`$${result.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <EquityChart equity={result.equity} candles={candles} initial={strategy.initialCapital} />

      <TradesTable trades={result.trades} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="border border-border/60 rounded-md p-3 bg-surface/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular mt-0.5", tone === "bull" && "text-bull", tone === "bear" && "text-bear")}>{value}</div>
    </div>
  );
}

function EquityChart({ equity, candles, initial }: { equity: { time: number; value: number }[]; candles: Candle[]; initial: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
      grid: { vertLines: { color: "rgba(148,163,184,0.06)" }, horzLines: { color: "rgba(148,163,184,0.06)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const eq = chart.addSeries(AreaSeries, {
      lineColor: "#22d3ee", topColor: "rgba(34,211,238,0.35)", bottomColor: "rgba(34,211,238,0)", lineWidth: 2,
    });
    const bh = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.7)", lineWidth: 1, lineStyle: LineStyle.Dashed });

    eq.setData(equity.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    if (candles.length) {
      const base = candles[0].close;
      bh.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: (c.close / base) * initial })));
    }
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => { chart.remove(); };
  }, [equity, candles, initial]);

  return (
    <div className="border border-border/60 rounded-md bg-surface/40">
      <div className="flex items-center gap-3 px-3 h-8 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Equity Curve</span>
        <span className="flex items-center gap-1 normal-case tracking-normal">
          <span className="w-2 h-0.5 bg-primary" /> Strategy
        </span>
        <span className="flex items-center gap-1 normal-case tracking-normal">
          <span className="w-2 h-0.5 bg-muted-foreground" /> Buy &amp; Hold
        </span>
      </div>
      <div ref={ref} style={{ height: 260 }} />
    </div>
  );
}

function TradesTable({ trades }: { trades: import("@/lib/strategy").Trade[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = useMemo(() => (showAll ? trades : trades.slice(-25).reverse()), [trades, showAll]);
  if (!trades.length) return <div className="text-sm text-muted-foreground text-center py-6">No trades were opened.</div>;
  return (
    <div className="border border-border/60 rounded-md bg-surface/40 overflow-hidden">
      <div className="flex items-center px-3 h-8 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Trades</span>
        <span className="ml-auto normal-case tracking-normal">
          <button onClick={() => setShowAll((v) => !v)} className="text-primary hover:text-primary/80">
            {showAll ? "Show recent 25" : `Show all ${trades.length}`}
          </button>
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs tabular">
          <thead className="text-[10px] uppercase text-muted-foreground bg-surface-2/50">
            <tr>
              <th className="text-left px-3 py-1.5">Entry</th>
              <th className="text-right px-3 py-1.5">Entry Px</th>
              <th className="text-left px-3 py-1.5">Exit</th>
              <th className="text-right px-3 py-1.5">Exit Px</th>
              <th className="text-right px-3 py-1.5">P&amp;L</th>
              <th className="text-right px-3 py-1.5">%</th>
              <th className="text-right px-3 py-1.5">Reason</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((t, i) => {
              const up = t.pnl >= 0;
              return (
                <tr key={i} className="border-t border-border/40 hover:bg-surface-2/40">
                  <td className="px-3 py-1 text-muted-foreground">{new Date(t.entryTime * 1000).toLocaleString()}</td>
                  <td className="px-3 py-1 text-right">{t.entryPrice.toFixed(4)}</td>
                  <td className="px-3 py-1 text-muted-foreground">{new Date(t.exitTime * 1000).toLocaleString()}</td>
                  <td className="px-3 py-1 text-right">{t.exitPrice.toFixed(4)}</td>
                  <td className={cn("px-3 py-1 text-right", up ? "text-bull" : "text-bear")}>
                    {up ? "+" : ""}{t.pnl.toFixed(2)}
                  </td>
                  <td className={cn("px-3 py-1 text-right flex items-center justify-end gap-1", up ? "text-bull" : "text-bear")}>
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {t.pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1 text-right uppercase text-[10px] text-muted-foreground">{t.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
