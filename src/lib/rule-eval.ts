// Shared server-safe evaluator for rule-based alerts and bots.
// Reuses the RuleSet/Condition/Operand types from strategy.ts.
import type { Candle } from "./binance";
import type { Condition, Operand, RuleSet } from "./strategy";
import { sma, ema, wma, rsi } from "./indicators";

function series(op: Operand, candles: Candle[]): number[] {
  const n = candles.length;
  if (op.kind === "price") return candles.map((c) => c.close);
  if (op.kind === "value") return new Array(n).fill(op.value ?? 0);
  const period = Math.max(1, op.period ?? 14);
  const out = new Array<number>(n).fill(NaN);
  const idx = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) idx.set(candles[i].time, i);
  const pts =
    op.kind === "sma" ? sma(candles, period) :
    op.kind === "ema" ? ema(candles, period) :
    op.kind === "wma" ? wma(candles, period) :
    op.kind === "rsi" ? rsi(candles, period) : [];
  for (const p of pts) {
    const i = idx.get(p.time);
    if (i !== undefined) out[i] = p.value;
  }
  return out;
}

function evalCond(c: Condition, L: number[], R: number[], i: number): boolean {
  const l = L[i], r = R[i];
  if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
  if (c.op === "gt") return l > r;
  if (c.op === "lt") return l < r;
  if (i === 0) return false;
  const lp = L[i - 1], rp = R[i - 1];
  if (!Number.isFinite(lp) || !Number.isFinite(rp)) return false;
  if (c.op === "crossesAbove") return lp <= rp && l > r;
  return lp >= rp && l < r;
}

export function evalRuleAtLast(rule: RuleSet, candles: Candle[]): boolean {
  if (!rule.conditions.length || candles.length < 2) return false;
  const i = candles.length - 1;
  const results = rule.conditions.map((c) => {
    const L = series(c.left, candles);
    const R = series(c.right, candles);
    return evalCond(c, L, R, i);
  });
  return rule.join === "AND" ? results.every(Boolean) : results.some(Boolean);
}
