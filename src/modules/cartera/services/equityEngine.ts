import type { OHLCVBar } from '@/lib/tauri';

export interface PortfolioTrade {
  id: string;
  timestamp: string; // ISO date string 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'
  symbol: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  price: number;
  fee?: number;
  side?: 'LONG' | 'SHORT';
  realizedPnl?: number;
}

export interface PortfolioPositionSnapshot {
  symbol: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  category?: 'Crypto' | 'Equity' | 'Bond' | 'Commodity';
}

export interface EquityCurvePoint {
  date: string; // 'YYYY-MM-DD'
  time: string;
  equity: number;
  cash: number;
  invested: number;
  unrealizedPnL: number;
  realizedPnLCumulative: number;
  highWaterMark: number;
  drawdownPct: number;
  reversionLine?: number;
  isHighPerformance?: boolean;
}

export interface DrawdownAnalysis {
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  longestDrawdownDays: number;
  currentDrawdownDays: number;
  avgRecoveryDays: number;
  singleDayMaxDrawdownPct: number;
}

export interface ReversionSlopeAnalysis {
  slope: number; // m in y = mx + b
  intercept: number;
  rSquared: number;
  isPositiveGrowth: boolean;
  performanceRatio: number; // Current equity / Reversion line
  regime: 'HIGH_PERFORMANCE' | 'UNDER_PERFORMANCE' | 'NEUTRAL';
}

export interface StreakAnalysis {
  currentStreakCount: number;
  currentStreakType: 'WIN' | 'LOSS' | 'FLAT';
  maxWinStreak: number;
  maxLossStreak: number;
}

/**
 * Calculates linear regression over the equity points (y = mx + b).
 */
export function calculateLinearRegression(points: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0] ?? 0, rSquared: 1 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = points[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: points[0] ?? 0, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Pearson R^2
  const numR = n * sumXY - sumX * sumY;
  const denR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const rSquared = denR === 0 ? 0 : Math.pow(numR / denR, 2);

  return { slope, intercept, rSquared };
}

/**
 * Calculates Drawdown metrics (depth, recovery, single day max).
 */
export function calculateDrawdownAnalysis(equityHistory: { date: string; equity: number }[]): DrawdownAnalysis {
  if (equityHistory.length === 0) {
    return {
      maxDrawdownPct: 0,
      currentDrawdownPct: 0,
      longestDrawdownDays: 0,
      currentDrawdownDays: 0,
      avgRecoveryDays: 0,
      singleDayMaxDrawdownPct: 0,
    };
  }

  let peak = equityHistory[0].equity;
  let maxDD = 0;
  let currentDD = 0;
  let singleDayMaxDD = 0;

  let currentDDDuration = 0;
  let longestDDDuration = 0;
  const recoveryDurations: number[] = [];
  let inDrawdown = false;

  for (let i = 0; i < equityHistory.length; i++) {
    const eq = equityHistory[i].equity;
    const prevEq = i > 0 ? equityHistory[i - 1].equity : eq;

    // Single day drop
    if (prevEq > 0) {
      const dailyDrop = ((eq - prevEq) / prevEq) * 100;
      if (dailyDrop < singleDayMaxDD) {
        singleDayMaxDD = dailyDrop;
      }
    }

    if (eq >= peak) {
      if (inDrawdown) {
        recoveryDurations.push(currentDDDuration);
        inDrawdown = false;
        currentDDDuration = 0;
      }
      peak = eq;
      currentDD = 0;
    } else {
      inDrawdown = true;
      currentDDDuration++;
      if (currentDDDuration > longestDDDuration) {
        longestDDDuration = currentDDDuration;
      }
      const dd = peak > 0 ? ((eq - peak) / peak) * 100 : 0;
      currentDD = dd;
      if (dd < maxDD) {
        maxDD = dd;
      }
    }
  }

  const avgRecoveryDays =
    recoveryDurations.length > 0
      ? recoveryDurations.reduce((a, b) => a + b, 0) / recoveryDurations.length
      : 0;

  return {
    maxDrawdownPct: Math.round(maxDD * 100) / 100,
    currentDrawdownPct: Math.round(currentDD * 100) / 100,
    longestDrawdownDays: longestDDDuration,
    currentDrawdownDays: inDrawdown ? currentDDDuration : 0,
    avgRecoveryDays: Math.round(avgRecoveryDays * 10) / 10,
    singleDayMaxDrawdownPct: Math.round(singleDayMaxDD * 100) / 100,
  };
}

/**
 * Calculates winning/losing streak statistics.
 */
export function calculateStreakAnalysis(dailyReturns: number[]): StreakAnalysis {
  let maxWin = 0;
  let maxLoss = 0;
  let currentStreak = 0;
  let currentType: 'WIN' | 'LOSS' | 'FLAT' = 'FLAT';

  for (const r of dailyReturns) {
    if (r > 0.0001) {
      if (currentType === 'WIN') {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentType = 'WIN';
      }
      if (currentStreak > maxWin) maxWin = currentStreak;
    } else if (r < -0.0001) {
      if (currentType === 'LOSS') {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentType = 'LOSS';
      }
      if (currentStreak > maxLoss) maxLoss = currentStreak;
    } else {
      currentStreak = 0;
      currentType = 'FLAT';
    }
  }

  return {
    currentStreakCount: currentStreak,
    currentStreakType: currentType,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
  };
}

/**
 * Computes full Equity Curve Series with Reversion Line and Performance Regime.
 */
export function buildEquityCurvePoints(
  rawPoints: { date: string; equity: number; cash: number; invested: number; unrealizedPnL: number; realizedPnLCumulative: number }[]
): {
  points: EquityCurvePoint[];
  drawdownAnalysis: DrawdownAnalysis;
  reversionAnalysis: ReversionSlopeAnalysis;
  streakAnalysis: StreakAnalysis;
} {
  if (rawPoints.length === 0) {
    return {
      points: [],
      drawdownAnalysis: calculateDrawdownAnalysis([]),
      reversionAnalysis: {
        slope: 0,
        intercept: 0,
        rSquared: 0,
        isPositiveGrowth: false,
        performanceRatio: 1,
        regime: 'NEUTRAL',
      },
      streakAnalysis: {
        currentStreakCount: 0,
        currentStreakType: 'FLAT',
        maxWinStreak: 0,
        maxLossStreak: 0,
      },
    };
  }

  const equities = rawPoints.map((p) => p.equity);
  const reg = calculateLinearRegression(equities);

  let highWaterMark = rawPoints[0].equity;
  const points: EquityCurvePoint[] = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const item = rawPoints[i];
    if (item.equity > highWaterMark) {
      highWaterMark = item.equity;
    }
    const ddPct = highWaterMark > 0 ? ((item.equity - highWaterMark) / highWaterMark) * 100 : 0;
    const revVal = reg.slope * i + reg.intercept;
    const isHigh = item.equity >= revVal;

    points.push({
      date: item.date,
      time: item.date,
      equity: item.equity,
      cash: item.cash,
      invested: item.invested,
      unrealizedPnL: item.unrealizedPnL,
      realizedPnLCumulative: item.realizedPnLCumulative,
      highWaterMark,
      drawdownPct: Math.round(ddPct * 100) / 100,
      reversionLine: Math.round(revVal * 100) / 100,
      isHighPerformance: isHigh,
    });
  }

  const drawdownAnalysis = calculateDrawdownAnalysis(rawPoints.map((p) => ({ date: p.date, equity: p.equity })));

  const dailyReturns: number[] = [];
  for (let i = 1; i < equities.length; i++) {
    const prev = equities[i - 1];
    dailyReturns.push(prev > 0 ? (equities[i] - prev) / prev : 0);
  }
  const streakAnalysis = calculateStreakAnalysis(dailyReturns);

  const lastPoint = points[points.length - 1];
  const lastRev = lastPoint.reversionLine ?? lastPoint.equity;
  const perfRatio = lastRev > 0 ? lastPoint.equity / lastRev : 1;
  const regime: 'HIGH_PERFORMANCE' | 'UNDER_PERFORMANCE' | 'NEUTRAL' =
    perfRatio > 1.01 ? 'HIGH_PERFORMANCE' : perfRatio < 0.99 ? 'UNDER_PERFORMANCE' : 'NEUTRAL';

  return {
    points,
    drawdownAnalysis,
    reversionAnalysis: {
      slope: Math.round(reg.slope * 100) / 100,
      intercept: Math.round(reg.intercept * 100) / 100,
      rSquared: Math.round(reg.rSquared * 10000) / 10000,
      isPositiveGrowth: reg.slope > 0,
      performanceRatio: Math.round(perfRatio * 1000) / 1000,
      regime,
    },
    streakAnalysis,
  };
}

/**
 * Converts equity curve points to OHLCV bars for TradingView Lightweight Charts.
 * Provides simulated daily candle variations (open, high, low, close) based on intraday swings.
 */
export function equityPointsToOHLCVBars(points: EquityCurvePoint[], symbol = 'PORTFOLIO:TOTAL'): OHLCVBar[] {
  return points.map((p, idx) => {
    const prevClose = idx > 0 ? points[idx - 1].equity : p.equity * 0.998;
    const open = prevClose;
    const close = p.equity;
    const swing = Math.abs(close - open) * 0.25;
    const high = Math.max(open, close) + swing;
    const low = Math.min(open, close) - swing;
    const volume = Math.round(p.invested * 0.05 + 1000);

    return {
      symbol,
      date: p.date,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    };
  });
}

/**
 * Generates synthetic OHLCV data for sub-components (composites, positions, trades).
 */
export function generateSyntheticBarsForSymbol(
  symbol: string,
  totalEquityBars: OHLCVBar[],
  multiplier = 1
): OHLCVBar[] {
  return totalEquityBars.map((b) => ({
    symbol,
    date: b.date,
    open: Math.round(b.open * multiplier * 100) / 100,
    high: Math.round(b.high * multiplier * 100) / 100,
    low: Math.round(b.low * multiplier * 100) / 100,
    close: Math.round(b.close * multiplier * 100) / 100,
    volume: Math.round(b.volume * multiplier),
  }));
}
