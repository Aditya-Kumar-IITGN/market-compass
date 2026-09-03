import type { Candle } from "./binance";
import { sma, ema, rsi, wma } from "./indicators";

// ---------- Types ----------

export type IndicatorKind = "price" | "sma" | "ema" | "wma" | "rsi" | "value";

export interface Operand {
  kind: IndicatorKind;
  period?: number; // for sma/ema/wma/rsi
  value?: number; // for value
}

export type Op = "gt" | "lt" | "crossesAbove" | "crossesBelow";

export interface Condition {
  id: string;
  left: Operand;
  op: Op;
  right: Operand;
}

export interface RuleSet {
  join: "AND" | "OR";
  conditions: Condition[];
}

export interface Strategy {
  name: string;
  entry: RuleSet;
  exit: RuleSet;
  initialCapital: number;
  positionPct: number; // 0..100 percent of equity used per trade
  feeBps: number; // fee per side, basis points
  slBps: number; // stop loss basis points (0 = disabled)
  tpBps: number; // take profit basis points (0 = disabled)
}

export const OP_LABELS: Record<Op, string> = {
  gt: ">",
  lt: "<",
  crossesAbove: "crosses ▲",
  crossesBelow: "crosses ▼",
};

export const KIND_LABELS: Record<IndicatorKind, string> = {
  price: "Price (close)",
  sma: "SMA",
  ema: "EMA",
  wma: "WMA",
  rsi: "RSI",
  value: "Value",
};

// ---------- Series resolver ----------

function resolveSeries(op: Operand, candles: Candle[]): number[] {
  const n = candles.length;
  if (op.kind === "price") return candles.map((c) => c.close);
  if (op.kind === "value") return new Array(n).fill(op.value ?? 0);

  const period = Math.max(1, op.period ?? 14);
  const empty = new Array(n).fill(NaN);
  const put = (pts: { time: number; value: number }[]) => {
    const idx = new Map<number, number>();
    for (let i = 0; i < candles.length; i++) idx.set(candles[i].time, i);
    for (const p of pts) {
      const i = idx.get(p.time);
      if (i !== undefined) empty[i] = p.value;
    }
    return empty;
  };
  if (op.kind === "sma") return put(sma(candles, period));
  if (op.kind === "ema") return put(ema(candles, period));
  if (op.kind === "wma") return put(wma(candles, period));
  if (op.kind === "rsi") return put(rsi(candles, period));
  return empty;
}

function evalCondition(cond: Condition, L: number[], R: number[], i: number): boolean {
  const l = L[i], r = R[i];
  if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
  if (cond.op === "gt") return l > r;
  if (cond.op === "lt") return l < r;
  if (i === 0) return false;
  const lp = L[i - 1], rp = R[i - 1];
  if (!Number.isFinite(lp) || !Number.isFinite(rp)) return false;
  if (cond.op === "crossesAbove") return lp <= rp && l > r;
  return lp >= rp && l < r; // crossesBelow
}

function evalRule(rule: RuleSet, series: number[][][], i: number): boolean {
  if (rule.conditions.length === 0) return false;
  const results = rule.conditions.map((c, idx) => evalCondition(c, series[idx][0], series[idx][1], i));
  return rule.join === "AND" ? results.every(Boolean) : results.some(Boolean);
}

// ---------- Backtest ----------

export interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  reason: "signal" | "sl" | "tp";
}

export interface EquityPoint { time: number; value: number }

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  finalEquity: number;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRate: number;
  wins: number;
  losses: number;
  avgPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  profitFactor: number;
  exposurePct: number;
}

export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  const entrySeries = strategy.entry.conditions.map((c) => [
    resolveSeries(c.left, candles),
    resolveSeries(c.right, candles),
  ]);
  const exitSeries = strategy.exit.conditions.map((c) => [
    resolveSeries(c.left, candles),
    resolveSeries(c.right, candles),
  ]);

  const fee = strategy.feeBps / 10000;
  const sl = strategy.slBps / 10000;
  const tp = strategy.tpBps / 10000;
  const posFrac = Math.max(0, Math.min(1, strategy.positionPct / 100));

  let cash = strategy.initialCapital;
  let qty = 0;
  let entryPrice = 0;
  let entryTime = 0;
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  let barsInMarket = 0;
  const returns: number[] = [];
  let prevEquity = strategy.initialCapital;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const price = c.close;

    // Manage open position: check SL/TP intrabar
    if (qty > 0) {
      barsInMarket++;
      let exitReason: Trade["reason"] | null = null;
      let exitPrice = 0;
      if (sl > 0 && c.low <= entryPrice * (1 - sl)) {
        exitReason = "sl"; exitPrice = entryPrice * (1 - sl);
      } else if (tp > 0 && c.high >= entryPrice * (1 + tp)) {
        exitReason = "tp"; exitPrice = entryPrice * (1 + tp);
      } else if (evalRule(strategy.exit, exitSeries, i)) {
        exitReason = "signal"; exitPrice = price;
      }
      if (exitReason) {
        const proceeds = qty * exitPrice * (1 - fee);
        const cost = qty * entryPrice * (1 + fee);
        const pnl = proceeds - cost;
        const pnlPct = (pnl / cost) * 100;
        trades.push({
          entryTime, entryPrice, exitTime: c.time, exitPrice, qty, pnl, pnlPct, reason: exitReason,
        });
        cash += proceeds;
        qty = 0;
      }
    }

    // Look for entry when flat
    if (qty === 0 && evalRule(strategy.entry, entrySeries, i)) {
      const spend = cash * posFrac;
      if (spend > 0 && price > 0) {
        qty = spend / (price * (1 + fee));
        cash -= qty * price * (1 + fee);
        entryPrice = price;
        entryTime = c.time;
      }
    }

    const eq = cash + qty * price;
    equity.push({ time: c.time, value: eq });
    if (prevEquity > 0) returns.push((eq - prevEquity) / prevEquity);
    prevEquity = eq;
  }

  // Close any open position at last bar for reporting
  if (qty > 0 && candles.length) {
    const last = candles[candles.length - 1];
    const exitPrice = last.close;
    const proceeds = qty * exitPrice * (1 - fee);
    const cost = qty * entryPrice * (1 + fee);
    const pnl = proceeds - cost;
    trades.push({
      entryTime, entryPrice, exitTime: last.time, exitPrice, qty, pnl,
      pnlPct: (pnl / cost) * 100, reason: "signal",
    });
    cash += proceeds;
    qty = 0;
    equity[equity.length - 1] = { time: last.time, value: cash };
  }

  const finalEquity = equity[equity.length - 1]?.value ?? strategy.initialCapital;
  const totalReturnPct = (finalEquity / strategy.initialCapital - 1) * 100;
  const buyHoldReturnPct = candles.length > 1
    ? (candles[candles.length - 1].close / candles[0].close - 1) * 100
    : 0;

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const avgPnlPct = trades.length ? trades.reduce((a, t) => a + t.pnlPct, 0) / trades.length : 0;
  const grossWin = trades.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  let peak = -Infinity;
  let maxDd = 0;
  for (const p of equity) {
    if (p.value > peak) peak = p.value;
    const dd = (peak - p.value) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1);
  const std = Math.sqrt(variance);
  // annualized-ish sharpe assuming per-bar returns; naive
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(365) : 0;

  const exposurePct = candles.length ? (barsInMarket / candles.length) * 100 : 0;

  return {
    trades, equity, finalEquity, totalReturnPct, buyHoldReturnPct,
    winRate, wins, losses, avgPnlPct, maxDrawdownPct: maxDd * 100,
    sharpe, profitFactor, exposurePct,
  };
}

// ---------- Presets ----------

const uid = () => crypto.randomUUID();

export function defaultStrategy(): Strategy {
  return {
    name: "EMA Cross",
    entry: {
      join: "AND",
      conditions: [{
        id: uid(),
        left: { kind: "ema", period: 20 },
        op: "crossesAbove",
        right: { kind: "ema", period: 50 },
      }],
    },
    exit: {
      join: "OR",
      conditions: [
        { id: uid(), left: { kind: "ema", period: 20 }, op: "crossesBelow", right: { kind: "ema", period: 50 } },
        { id: uid(), left: { kind: "rsi", period: 14 }, op: "gt", right: { kind: "value", value: 75 } },
      ],
    },
    initialCapital: 10000,
    positionPct: 100,
    feeBps: 10,
    slBps: 0,
    tpBps: 0,
  };
}

export function newCondition(): Condition {
  return {
    id: uid(),
    left: { kind: "price" },
    op: "gt",
    right: { kind: "sma", period: 50 },
  };
}
