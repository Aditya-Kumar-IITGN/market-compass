/**
 * Overnight (Close-to-Open) & Daytime (Open-to-Close) Backtest Engine
 *
 * Implements the strategy from:
 *   "The Overnight Return Temporal Market Anomaly" — Basdekidou (2017)
 *
 * ORA Rule: Buy at the Close → Hold Overnight → Sell at the Open
 * Daytime:  Buy at the Open  → Sell at the Close
 *
 * Supports both compounding equity and flat-capital-per-trade modes.
 */

// ─── Interfaces ──────────────────────────────────────────────

export interface OvernightTrade {
  buyTime: number;
  buyPrice: number;
  sellTime: number;
  sellPrice: number;
  returnPct: number;  // after fees
  pnl: number;        // dollar P&L
}

export interface StrategyMetrics {
  totalReturnPct: number;
  annualizedReturnPct: number;
  annualStdDev: number;
  sharpe: number;
  sortinoRatio: number;
  calmarRatio: number;

  winRate: number;
  wins: number;
  losses: number;
  totalTrades: number;

  avgReturnPct: number;
  medianReturnPct: number;
  avgWinPct: number;
  avgLossPct: number;
  bestTradePct: number;
  worstTradePct: number;

  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;

  maxDrawdownPct: number;
  finalEquity: number;

  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface OvernightResult {
  symbol: string;
  name: string;
  region: string;

  overnight: StrategyMetrics;
  daytime: StrategyMetrics;

  equity: { time: number; value: number }[];
  daytimeEquity: { time: number; value: number }[];
  buyHoldReturnPct: number;
  buyHoldEquity: { time: number; value: number }[];

  error?: string;
}

export interface OvernightCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioMetrics {
  totalPnL: number;
  totalGrossProfit: number;
  totalGrossLoss: number;
  totalWins: number;
  totalLosses: number;
  totalTrades: number;
  avgWinRate: number;
  avgTotalReturn: number;
  medianTotalReturn: number;
  avgAnnualReturn: number;
  avgAnnualStdDev: number;
  avgSharpe: number;
  avgSortino: number;
  avgCalmar: number;
  avgProfitFactor: number;
  avgMaxDrawdown: number;
  portfolioSharpe: number;
  portfolioMaxDrawdownPct: number;
  portfolioAnnualizedReturn: number;
}

export interface OvernightSummary {
  totalStocks: number;
  successfulStocks: number;
  failedStocks: number;

  overnight: PortfolioMetrics;
  daytime: PortfolioMetrics;

  avgBuyHoldReturn: number;

  aggregateEquity: { time: number; value: number }[];
  aggregateDaytimeEquity: { time: number; value: number }[];
  aggregateBuyHoldEquity: { time: number; value: number }[];

  bestOvernightStock: { symbol: string; returnPct: number } | null;
  worstOvernightStock: { symbol: string; returnPct: number } | null;
  bestDaytimeStock: { symbol: string; returnPct: number } | null;
  worstDaytimeStock: { symbol: string; returnPct: number } | null;

  positiveStocksOvernight: number;
  negativeStocksOvernight: number;
  positiveStocksDaytime: number;
  negativeStocksDaytime: number;

  regionBreakdown: { region: string; count: number; overnightProfitable: number; daytimeProfitable: number }[];

  results: OvernightResult[];
}

// ─── Engine ──────────────────────────────────────────────────

export function runOvernightBacktest(
  symbol: string,
  name: string,
  region: string,
  candles: OvernightCandle[],
  initialCapital = 100000,
  feeModel: "bps" | "per_share" = "per_share",
  feeValue = 0.01,
  compoundMode = true,
): OvernightResult {
  if (candles.length < 2) {
    return makeErrorResult(symbol, name, region, "Insufficient data (< 2 candles)");
  }

  let overnightEquity = initialCapital;
  let daytimeEquity = initialCapital;

  const overnightTrades: OvernightTrade[] = [];
  const daytimeTrades: OvernightTrade[] = [];

  const equityCurve: { time: number; value: number }[] = [{ time: candles[0].time, value: overnightEquity }];
  const daytimeEquityCurve: { time: number; value: number }[] = [{ time: candles[0].time, value: daytimeEquity }];
  const buyHoldEquity: { time: number; value: number }[] = [{ time: candles[0].time, value: initialCapital }];

  const overnightReturns: number[] = [];
  const daytimeReturns: number[] = [];

  const getFee = (price: number, qty: number) =>
    feeModel === "bps" ? price * qty * (feeValue / 10000) : qty * feeValue;

  const firstClose = candles[0].close;

  for (let i = 0; i < candles.length - 1; i++) {
    // ── Daytime Strategy (Buy Open, Sell Close) ──
    const dayBuy = candles[i].open;
    const daySell = candles[i].close;
    if (dayBuy > 0 && daySell > 0) {
      const capital = compoundMode ? daytimeEquity : initialCapital;
      const dayQty = Math.floor(capital / dayBuy);
      if (dayQty > 0) {
        const buyFee = getFee(dayBuy, dayQty);
        const sellFee = getFee(daySell, dayQty);
        const cost = dayQty * dayBuy + buyFee;
        const proceeds = dayQty * daySell - sellFee;
        const pnl = proceeds - cost;
        const returnPct = (pnl / cost) * 100;

        if (compoundMode) {
          daytimeEquity = daytimeEquity + pnl;
        } else {
          daytimeEquity = daytimeEquity + pnl;
        }
        daytimeReturns.push(returnPct / 100);
        daytimeTrades.push({
          buyTime: candles[i].time, buyPrice: dayBuy,
          sellTime: candles[i].time, sellPrice: daySell,
          returnPct, pnl,
        });
        daytimeEquityCurve.push({ time: candles[i].time, value: daytimeEquity });
      }
    }

    // ── Overnight Strategy (Buy Close, Sell Next Open) ──
    const buyPrice = candles[i].close;
    const sellPrice = candles[i + 1].open;

    if (!buyPrice || !sellPrice || buyPrice <= 0 || sellPrice <= 0) continue;

    const capital = compoundMode ? overnightEquity : initialCapital;
    const qty = Math.floor(capital / buyPrice);
    if (qty <= 0) continue;

    const buyFee = getFee(buyPrice, qty);
    const sellFee = getFee(sellPrice, qty);
    const cost = qty * buyPrice + buyFee;
    const proceeds = qty * sellPrice - sellFee;
    const pnl = proceeds - cost;
    const returnPct = (pnl / cost) * 100;

    if (compoundMode) {
      overnightEquity = overnightEquity + pnl;
    } else {
      overnightEquity = overnightEquity + pnl;
    }
    overnightReturns.push(returnPct / 100);

    overnightTrades.push({
      buyTime: candles[i].time, buyPrice,
      sellTime: candles[i + 1].time, sellPrice,
      returnPct, pnl,
    });

    equityCurve.push({ time: candles[i + 1].time, value: overnightEquity });

    // ── Buy & Hold equity tracking ──
    if (firstClose > 0) {
      const bhValue = initialCapital * (candles[i + 1].close / firstClose);
      buyHoldEquity.push({ time: candles[i + 1].time, value: bhValue });
    }
  }

  if (overnightTrades.length === 0) {
    return makeErrorResult(symbol, name, region, "No valid trades generated");
  }

  const overnight = computeStrategyMetrics(overnightReturns, overnightTrades, overnightEquity, equityCurve, initialCapital);
  const daytime = computeStrategyMetrics(daytimeReturns, daytimeTrades, daytimeEquity, daytimeEquityCurve, initialCapital);

  const buyHoldReturnPct = candles.length > 1
    ? (candles[candles.length - 1].close / candles[0].close - 1) * 100
    : 0;

  return {
    symbol, name, region,
    overnight,
    daytime,
    equity: equityCurve,
    daytimeEquity: daytimeEquityCurve,
    buyHoldReturnPct,
    buyHoldEquity,
  };
}

// ─── Metrics Calculator ──────────────────────────────────────

function computeStrategyMetrics(
  dailyReturns: number[],
  trades: OvernightTrade[],
  finalEq: number,
  equityCurve: { time: number; value: number }[],
  initialCapital: number,
): StrategyMetrics {
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  const retPcts = trades.map(t => t.returnPct);
  const sorted = [...retPcts].sort((a, b) => a - b);
  const avgReturnPct = retPcts.length > 0 ? retPcts.reduce((a, b) => a + b, 0) / retPcts.length : 0;
  const medianReturnPct = sorted.length > 0
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : 0;

  const winningPcts = retPcts.filter(r => r > 0);
  const losingPcts = retPcts.filter(r => r <= 0);
  const avgWinPct = winningPcts.length > 0 ? winningPcts.reduce((a, b) => a + b, 0) / winningPcts.length : 0;
  const avgLossPct = losingPcts.length > 0 ? losingPcts.reduce((a, b) => a + b, 0) / losingPcts.length : 0;
  const bestTradePct = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const worstTradePct = sorted.length > 0 ? sorted[0] : 0;

  // P&L aggregates
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
  const netProfit = finalEq - initialCapital;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Return & risk metrics
  const totalReturnPct = (finalEq / initialCapital - 1) * 100;
  const yrs = trades.length / 252;
  const annualizedReturnPct = yrs > 0 ? (Math.pow(finalEq / initialCapital, 1 / yrs) - 1) * 100 : totalReturnPct;

  // Std dev (annualized)
  const mean = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length : 0;
  const dailyStd = Math.sqrt(variance);
  const annualStdDev = dailyStd * Math.sqrt(252) * 100; // as percentage

  // Sharpe (annualized, no risk-free rate — matching the paper)
  const sharpe = dailyStd > 0 ? (mean / dailyStd) * Math.sqrt(252) : 0;

  // Sortino (downside deviation)
  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((a, b) => a + b ** 2, 0) / dailyReturns.length
    : 0;
  const downsideStd = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStd > 0 ? (mean / downsideStd) * Math.sqrt(252) : 0;

  // Max Drawdown
  let peak = -Infinity;
  let maxDrawdownPct = 0;
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value;
    const dd = (peak - p.value) / peak * 100;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Calmar Ratio
  const calmarRatio = maxDrawdownPct > 0 ? annualizedReturnPct / maxDrawdownPct : 0;

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0;
  let curWins = 0, curLosses = 0;
  for (const t of trades) {
    if (t.pnl > 0) {
      curWins++;
      curLosses = 0;
      if (curWins > maxConsecWins) maxConsecWins = curWins;
    } else {
      curLosses++;
      curWins = 0;
      if (curLosses > maxConsecLosses) maxConsecLosses = curLosses;
    }
  }

  return {
    totalReturnPct,
    annualizedReturnPct,
    annualStdDev,
    sharpe,
    sortinoRatio,
    calmarRatio,
    winRate,
    wins,
    losses,
    totalTrades: trades.length,
    avgReturnPct,
    medianReturnPct,
    avgWinPct,
    avgLossPct,
    bestTradePct,
    worstTradePct,
    grossProfit,
    grossLoss,
    netProfit,
    profitFactor,
    maxDrawdownPct,
    finalEquity: finalEq,
    consecutiveWins: maxConsecWins,
    consecutiveLosses: maxConsecLosses,
  };
}

// ─── Aggregation ─────────────────────────────────────────────

export function aggregateResults(results: OvernightResult[]): OvernightSummary {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  const emptyPortfolio: PortfolioMetrics = {
    totalPnL: 0, totalGrossProfit: 0, totalGrossLoss: 0,
    totalWins: 0, totalLosses: 0, totalTrades: 0,
    avgWinRate: 0, avgTotalReturn: 0, medianTotalReturn: 0,
    avgAnnualReturn: 0, avgAnnualStdDev: 0, avgSharpe: 0,
    avgSortino: 0, avgCalmar: 0, avgProfitFactor: 0, avgMaxDrawdown: 0,
    portfolioSharpe: 0, portfolioMaxDrawdownPct: 0, portfolioAnnualizedReturn: 0,
  };

  if (successful.length === 0) {
    return {
      totalStocks: results.length,
      successfulStocks: 0,
      failedStocks: failed.length,
      overnight: { ...emptyPortfolio },
      daytime: { ...emptyPortfolio },
      avgBuyHoldReturn: 0,
      aggregateEquity: [],
      aggregateDaytimeEquity: [],
      aggregateBuyHoldEquity: [],
      bestOvernightStock: null, worstOvernightStock: null,
      bestDaytimeStock: null, worstDaytimeStock: null,
      positiveStocksOvernight: 0, negativeStocksOvernight: 0,
      positiveStocksDaytime: 0, negativeStocksDaytime: 0,
      regionBreakdown: [],
      results,
    };
  }

  // ── Aggregate equity curves ──
  const timeSet = new Set<number>();
  for (const r of successful) {
    for (const pt of r.equity) timeSet.add(pt.time);
  }
  const times = Array.from(timeSet).sort((a, b) => a - b);

  const aggregateEquity: { time: number; value: number }[] = [];
  const aggregateDaytimeEquity: { time: number; value: number }[] = [];
  const aggregateBuyHoldEquity: { time: number; value: number }[] = [];

  // Build index maps for O(1) lookup instead of .find()
  const eqMaps: Map<number, number>[] = [];
  const dayEqMaps: Map<number, number>[] = [];
  const bhMaps: Map<number, number>[] = [];
  for (const r of successful) {
    const em = new Map<number, number>(); for (const p of r.equity) em.set(p.time, p.value);
    const dm = new Map<number, number>(); for (const p of r.daytimeEquity) dm.set(p.time, p.value);
    const bm = new Map<number, number>(); for (const p of r.buyHoldEquity) bm.set(p.time, p.value);
    eqMaps.push(em); dayEqMaps.push(dm); bhMaps.push(bm);
  }

  const lastEq = successful.map(r => r.equity.length > 0 ? r.equity[0].value : 0);
  const lastDayEq = successful.map(r => r.daytimeEquity.length > 0 ? r.daytimeEquity[0].value : 0);
  const lastBhEq = successful.map(r => r.buyHoldEquity.length > 0 ? r.buyHoldEquity[0].value : 0);

  for (const t of times) {
    let sumOvn = 0, sumDay = 0, sumBh = 0;
    for (let i = 0; i < successful.length; i++) {
      const ov = eqMaps[i].get(t); if (ov !== undefined) lastEq[i] = ov;
      const dv = dayEqMaps[i].get(t); if (dv !== undefined) lastDayEq[i] = dv;
      const bv = bhMaps[i].get(t); if (bv !== undefined) lastBhEq[i] = bv;
      sumOvn += lastEq[i];
      sumDay += lastDayEq[i];
      sumBh += lastBhEq[i];
    }
    aggregateEquity.push({ time: t, value: sumOvn });
    aggregateDaytimeEquity.push({ time: t, value: sumDay });
    aggregateBuyHoldEquity.push({ time: t, value: sumBh });
  }

  // ── Portfolio-level metrics for a strategy ──
  function computePortfolioMetrics(
    accessor: (r: OvernightResult) => StrategyMetrics,
    aggCurve: { time: number; value: number }[],
    initialCapitalPerStock: number,
  ): PortfolioMetrics {
    const n = successful.length;
    const metrics = successful.map(accessor);

    const totalPnL = metrics.reduce((s, m) => s + m.netProfit, 0);
    const totalGrossProfit = metrics.reduce((s, m) => s + m.grossProfit, 0);
    const totalGrossLoss = metrics.reduce((s, m) => s + m.grossLoss, 0);
    const totalWins = metrics.reduce((s, m) => s + m.wins, 0);
    const totalLosses = metrics.reduce((s, m) => s + m.losses, 0);
    const totalTrades = metrics.reduce((s, m) => s + m.totalTrades, 0);

    const avgWinRate = metrics.reduce((s, m) => s + m.winRate, 0) / n;
    const avgTotalReturn = metrics.reduce((s, m) => s + m.totalReturnPct, 0) / n;
    const avgAnnualReturn = metrics.reduce((s, m) => s + m.annualizedReturnPct, 0) / n;
    const avgAnnualStdDev = metrics.reduce((s, m) => s + m.annualStdDev, 0) / n;
    const avgSharpe = metrics.reduce((s, m) => s + m.sharpe, 0) / n;
    const avgSortino = metrics.reduce((s, m) => s + m.sortinoRatio, 0) / n;
    const avgCalmar = metrics.reduce((s, m) => s + m.calmarRatio, 0) / n;
    const pfs = metrics.filter(m => m.profitFactor < 999);
    const avgProfitFactor = pfs.length > 0 ? pfs.reduce((s, m) => s + m.profitFactor, 0) / pfs.length : 0;
    const avgMaxDrawdown = metrics.reduce((s, m) => s + m.maxDrawdownPct, 0) / n;

    const sortedReturns = [...metrics].sort((a, b) => a.totalReturnPct - b.totalReturnPct);
    const medianTotalReturn = sortedReturns.length % 2 === 0
      ? (sortedReturns[sortedReturns.length / 2 - 1].totalReturnPct + sortedReturns[sortedReturns.length / 2].totalReturnPct) / 2
      : sortedReturns[Math.floor(sortedReturns.length / 2)].totalReturnPct;

    // Portfolio-level Sharpe from aggregate equity curve
    let portfolioSharpe = 0;
    let portfolioMaxDrawdownPct = 0;
    let portfolioAnnualizedReturn = 0;
    if (aggCurve.length > 1) {
      const dailyPctReturns: number[] = [];
      for (let i = 1; i < aggCurve.length; i++) {
        if (aggCurve[i - 1].value > 0) {
          dailyPctReturns.push(aggCurve[i].value / aggCurve[i - 1].value - 1);
        }
      }
      if (dailyPctReturns.length > 0) {
        const m = dailyPctReturns.reduce((a, b) => a + b, 0) / dailyPctReturns.length;
        const v = dailyPctReturns.reduce((a, b) => a + (b - m) ** 2, 0) / dailyPctReturns.length;
        const s = Math.sqrt(v);
        portfolioSharpe = s > 0 ? (m / s) * Math.sqrt(252) : 0;
      }

      // Portfolio max drawdown
      let peak = -Infinity;
      for (const p of aggCurve) {
        if (p.value > peak) peak = p.value;
        const dd = (peak - p.value) / peak * 100;
        if (dd > portfolioMaxDrawdownPct) portfolioMaxDrawdownPct = dd;
      }

      // Portfolio annualized return
      const totalCapital = initialCapitalPerStock * n;
      const finalValue = aggCurve[aggCurve.length - 1].value;
      const yrs = dailyPctReturns.length / 252;
      if (yrs > 0 && totalCapital > 0) {
        portfolioAnnualizedReturn = (Math.pow(finalValue / totalCapital, 1 / yrs) - 1) * 100;
      }
    }

    return {
      totalPnL, totalGrossProfit, totalGrossLoss,
      totalWins, totalLosses, totalTrades,
      avgWinRate, avgTotalReturn, medianTotalReturn,
      avgAnnualReturn, avgAnnualStdDev, avgSharpe,
      avgSortino, avgCalmar, avgProfitFactor, avgMaxDrawdown,
      portfolioSharpe, portfolioMaxDrawdownPct, portfolioAnnualizedReturn,
    };
  }

  // Use a sensible default; the actual value comes from the caller
  const initialCapitalPerStock = successful[0]?.overnight?.finalEquity
    ? successful[0].overnight.finalEquity - successful[0].overnight.netProfit
    : 10000;

  const overnightPortfolio = computePortfolioMetrics(r => r.overnight, aggregateEquity, initialCapitalPerStock);
  const daytimePortfolio = computePortfolioMetrics(r => r.daytime, aggregateDaytimeEquity, initialCapitalPerStock);

  // ── Best/worst stocks ──
  const bestOvn = successful.reduce((a, b) => a.overnight.totalReturnPct > b.overnight.totalReturnPct ? a : b);
  const worstOvn = successful.reduce((a, b) => a.overnight.totalReturnPct < b.overnight.totalReturnPct ? a : b);
  const bestDay = successful.reduce((a, b) => a.daytime.totalReturnPct > b.daytime.totalReturnPct ? a : b);
  const worstDay = successful.reduce((a, b) => a.daytime.totalReturnPct < b.daytime.totalReturnPct ? a : b);

  // ── Region breakdown ──
  const regionMap = new Map<string, { count: number; overnightProfitable: number; daytimeProfitable: number }>();
  for (const r of successful) {
    const entry = regionMap.get(r.region) || { count: 0, overnightProfitable: 0, daytimeProfitable: 0 };
    entry.count++;
    if (r.overnight.totalReturnPct > 0) entry.overnightProfitable++;
    if (r.daytime.totalReturnPct > 0) entry.daytimeProfitable++;
    regionMap.set(r.region, entry);
  }
  const regionBreakdown = Array.from(regionMap.entries()).map(([region, data]) => ({ region, ...data }));

  return {
    totalStocks: results.length,
    successfulStocks: successful.length,
    failedStocks: failed.length,
    overnight: overnightPortfolio,
    daytime: daytimePortfolio,
    avgBuyHoldReturn: successful.reduce((s, r) => s + r.buyHoldReturnPct, 0) / successful.length,
    aggregateEquity,
    aggregateDaytimeEquity,
    aggregateBuyHoldEquity,
    bestOvernightStock: { symbol: bestOvn.symbol, returnPct: bestOvn.overnight.totalReturnPct },
    worstOvernightStock: { symbol: worstOvn.symbol, returnPct: worstOvn.overnight.totalReturnPct },
    bestDaytimeStock: { symbol: bestDay.symbol, returnPct: bestDay.daytime.totalReturnPct },
    worstDaytimeStock: { symbol: worstDay.symbol, returnPct: worstDay.daytime.totalReturnPct },
    positiveStocksOvernight: successful.filter(r => r.overnight.totalReturnPct > 0).length,
    negativeStocksOvernight: successful.filter(r => r.overnight.totalReturnPct <= 0).length,
    positiveStocksDaytime: successful.filter(r => r.daytime.totalReturnPct > 0).length,
    negativeStocksDaytime: successful.filter(r => r.daytime.totalReturnPct <= 0).length,
    regionBreakdown,
    results,
  };
}

// ─── Error Result ────────────────────────────────────────────

const ZERO_METRICS: StrategyMetrics = {
  totalReturnPct: 0, annualizedReturnPct: 0, annualStdDev: 0,
  sharpe: 0, sortinoRatio: 0, calmarRatio: 0,
  winRate: 0, wins: 0, losses: 0, totalTrades: 0,
  avgReturnPct: 0, medianReturnPct: 0, avgWinPct: 0, avgLossPct: 0,
  bestTradePct: 0, worstTradePct: 0,
  grossProfit: 0, grossLoss: 0, netProfit: 0, profitFactor: 0,
  maxDrawdownPct: 0, finalEquity: 0,
  consecutiveWins: 0, consecutiveLosses: 0,
};

function makeErrorResult(symbol: string, name: string, region: string, error: string): OvernightResult {
  return {
    symbol, name, region, error,
    overnight: { ...ZERO_METRICS },
    daytime: { ...ZERO_METRICS },
    equity: [], daytimeEquity: [], buyHoldEquity: [],
    buyHoldReturnPct: 0,
  };
}
