import type { Candle } from "./binance";

export interface LinePoint { time: number; value: number }

export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

export function ema(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i].close;
    if (i === 0) prev = c;
    else prev = c * k + prev * (1 - k);
    if (i >= period - 1) out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

export function wma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < candles.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += candles[i - j].close * (period - j);
    out.push({ time: candles[i].time, value: s / denom });
  }
  return out;
}

export function vwap(candles: Candle[]): LinePoint[] {
  const out: LinePoint[] = [];
  let cumPV = 0, cumV = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumV += c.volume;
    out.push({ time: c.time, value: cumV ? cumPV / cumV : c.close });
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  let avgG = 0, avgL = 0;
  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = Math.max(diff, 0);
    const l = Math.max(-diff, 0);
    if (i <= period) {
      avgG += g; avgL += l;
      if (i === period) { avgG /= period; avgL /= period; }
    } else {
      avgG = (avgG * (period - 1) + g) / period;
      avgL = (avgL * (period - 1) + l) / period;
    }
    if (i >= period) {
      const rs = avgL === 0 ? 100 : avgG / avgL;
      const v = avgL === 0 ? 100 : 100 - 100 / (1 + rs);
      out.push({ time: candles[i].time, value: v });
    }
  }
  return out;
}

export function macd(
  candles: Candle[],
  fast = 12, slow = 26, signal = 9,
): { macd: LinePoint[]; signal: LinePoint[]; hist: LinePoint[] } {
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  const map = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: LinePoint[] = [];
  for (const p of emaSlow) {
    const f = map.get(p.time);
    if (f !== undefined) macdLine.push({ time: p.time, value: f - p.value });
  }
  // signal = EMA of macdLine
  const k = 2 / (signal + 1);
  const sig: LinePoint[] = [];
  let prev = 0;
  for (let i = 0; i < macdLine.length; i++) {
    prev = i === 0 ? macdLine[i].value : macdLine[i].value * k + prev * (1 - k);
    if (i >= signal - 1) sig.push({ time: macdLine[i].time, value: prev });
  }
  const sigMap = new Map(sig.map((p) => [p.time, p.value]));
  const hist: LinePoint[] = macdLine
    .filter((p) => sigMap.has(p.time))
    .map((p) => ({ time: p.time, value: p.value - (sigMap.get(p.time) as number) }));
  return { macd: macdLine, signal: sig, hist };
}

export function bollinger(
  candles: Candle[], period = 20, mult = 2,
): { upper: LinePoint[]; middle: LinePoint[]; lower: LinePoint[] } {
  const middle = sma(candles, period);
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const mean = middle[i - period + 1].value;
    let sq = 0;
    for (let j = 0; j < period; j++) {
      const d = candles[i - j].close - mean;
      sq += d * d;
    }
    const sd = Math.sqrt(sq / period);
    upper.push({ time: candles[i].time, value: mean + mult * sd });
    lower.push({ time: candles[i].time, value: mean - mult * sd });
  }
  return { upper, middle, lower };
}

export function atr(candles: Candle[], period = 14): LinePoint[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { trs.push(candles[i].high - candles[i].low); continue; }
    const prev = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev),
      Math.abs(candles[i].low - prev),
    );
    trs.push(tr);
  }
  const out: LinePoint[] = [];
  let prev = 0;
  for (let i = 0; i < trs.length; i++) {
    if (i < period) { prev += trs[i]; if (i === period - 1) prev /= period; }
    else prev = (prev * (period - 1) + trs[i]) / period;
    if (i >= period - 1) out.push({ time: candles[i].time, value: prev });
  }
  return out;
}
