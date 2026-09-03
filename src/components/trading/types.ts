export type IndicatorType = "sma" | "ema" | "wma" | "vwap" | "bb" | "rsi" | "macd";

export interface BaseIndicator {
  id: string;
  visible: boolean;
  color?: string;
}

export type IndicatorConfig =
  | (BaseIndicator & { type: "sma" | "ema" | "wma"; period: number })
  | (BaseIndicator & { type: "vwap" })
  | (BaseIndicator & { type: "bb"; period: number; mult: number })
  | (BaseIndicator & { type: "rsi"; period: number })
  | (BaseIndicator & { type: "macd"; fast: number; slow: number; signal: number });

export const INDICATOR_PRESETS: Record<IndicatorType, () => IndicatorConfig> = {
  sma: () => ({ id: crypto.randomUUID(), type: "sma", period: 20, visible: true, color: "#22d3ee" }),
  ema: () => ({ id: crypto.randomUUID(), type: "ema", period: 50, visible: true, color: "#f59e0b" }),
  wma: () => ({ id: crypto.randomUUID(), type: "wma", period: 20, visible: true, color: "#a78bfa" }),
  vwap: () => ({ id: crypto.randomUUID(), type: "vwap", visible: true, color: "#f472b6" }),
  bb: () => ({ id: crypto.randomUUID(), type: "bb", period: 20, mult: 2, visible: true, color: "#94a3b8" }),
  rsi: () => ({ id: crypto.randomUUID(), type: "rsi", period: 14, visible: true }),
  macd: () => ({ id: crypto.randomUUID(), type: "macd", fast: 12, slow: 26, signal: 9, visible: true }),
};

export const INDICATOR_LABELS: Record<IndicatorType, string> = {
  sma: "SMA — Simple Moving Avg",
  ema: "EMA — Exponential Moving Avg",
  wma: "WMA — Weighted Moving Avg",
  vwap: "VWAP — Volume Weighted Avg",
  bb: "Bollinger Bands",
  rsi: "RSI — Relative Strength",
  macd: "MACD",
};
