import { Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import {
  INDICATOR_LABELS, INDICATOR_PRESETS, type IndicatorConfig, type IndicatorType,
} from "./types";
import { cn } from "@/lib/utils";

interface Props {
  indicators: IndicatorConfig[];
  onChange: (next: IndicatorConfig[]) => void;
}

export function IndicatorsPanel({ indicators, onChange }: Props) {
  const [adding, setAdding] = useState(false);

  const add = (type: IndicatorType) => {
    onChange([...indicators, INDICATOR_PRESETS[type]()]);
    setAdding(false);
  };
  const remove = (id: string) => onChange(indicators.filter((i) => i.id !== id));
  const toggle = (id: string) =>
    onChange(indicators.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)));
  const update = (id: string, patch: Partial<IndicatorConfig>) =>
    onChange(indicators.map((i) => (i.id === id ? ({ ...i, ...patch } as IndicatorConfig) : i)));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 flex items-center justify-between">
        <span>Indicators</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-primary hover:text-primary/80 flex items-center gap-1 text-[10px] normal-case tracking-normal"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {adding && (
        <div className="border-b border-border/60 bg-surface-2/50 py-1">
          {(Object.keys(INDICATOR_LABELS) as IndicatorType[]).map((t) => (
            <button
              key={t}
              onClick={() => add(t)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 text-foreground/90"
            >
              {INDICATOR_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {indicators.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No indicators. Click <span className="text-primary">+ Add</span> to start.
          </div>
        )}
        {indicators.map((ind) => (
          <div key={ind.id} className="border-b border-border/40 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {"color" in ind && ind.color && (
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ind.color }} />
                )}
                <span className="text-xs font-medium text-foreground uppercase">{ind.type}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggle(ind.id)} className="text-muted-foreground hover:text-foreground p-1">
                  {ind.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => remove(ind.id)} className="text-muted-foreground hover:text-bear p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px]">
              {(ind.type === "sma" || ind.type === "ema" || ind.type === "wma" || ind.type === "bb" || ind.type === "rsi") && (
                <NumberField
                  label="Period"
                  value={ind.period}
                  onChange={(v) => update(ind.id, { period: v } as Partial<IndicatorConfig>)}
                />
              )}
              {ind.type === "bb" && (
                <NumberField
                  label="Mult"
                  value={ind.mult}
                  step={0.5}
                  onChange={(v) => update(ind.id, { mult: v } as Partial<IndicatorConfig>)}
                />
              )}
              {ind.type === "macd" && (
                <>
                  <NumberField label="Fast" value={ind.fast} onChange={(v) => update(ind.id, { fast: v } as Partial<IndicatorConfig>)} />
                  <NumberField label="Slow" value={ind.slow} onChange={(v) => update(ind.id, { slow: v } as Partial<IndicatorConfig>)} />
                  <NumberField label="Signal" value={ind.signal} onChange={(v) => update(ind.id, { signal: v } as Partial<IndicatorConfig>)} />
                </>
              )}
              {"color" in ind && ind.color !== undefined && (
                <label className="flex items-center gap-1 text-muted-foreground">
                  <span>Color</span>
                  <input
                    type="color"
                    value={ind.color}
                    onChange={(e) => update(ind.id, { color: e.target.value } as Partial<IndicatorConfig>)}
                    className="w-5 h-5 bg-transparent border border-border rounded cursor-pointer"
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-muted-foreground">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-14 bg-input border border-border rounded px-1.5 py-0.5 text-foreground text-[10px] tabular",
          "focus:outline-none focus:ring-1 focus:ring-primary",
        )}
      />
    </label>
  );
}
