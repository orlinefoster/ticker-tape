import { describe, it, expect } from 'vitest';
import {
  calculateLinearRegression,
  calculateDrawdownAnalysis,
  calculateStreakAnalysis,
  buildEquityCurvePoints,
  equityPointsToOHLCVBars,
} from './equityEngine';
import { calculateExoMetrics } from './exoScalingEngine';
import { calculatePositionVWAP } from './vwapEngine';
import { calculateRiskReturnMetrics } from './riskReturnEngine';

describe('Cartera & Equity Engine Tests', () => {
  it('calculates linear regression and reversion line correctly', () => {
    const series = [100, 110, 120, 130, 140];
    const reg = calculateLinearRegression(series);
    expect(reg.slope).toBeCloseTo(10, 2);
    expect(reg.intercept).toBeCloseTo(100, 2);
    expect(reg.rSquared).toBeCloseTo(1, 2);
  });

  it('calculates drawdown depth, duration and single-day max drawdown', () => {
    const history = [
      { date: '2026-09-01', equity: 100 },
      { date: '2026-09-02', equity: 120 }, // peak
      { date: '2026-09-03', equity: 96 },  // -20% from peak, -20% single day
      { date: '2026-09-04', equity: 108 }, // -10% from peak
      { date: '2026-09-05', equity: 125 }, // new peak, recovered
    ];

    const dd = calculateDrawdownAnalysis(history);
    expect(dd.maxDrawdownPct).toBe(-20);
    expect(dd.currentDrawdownPct).toBe(0);
    expect(dd.longestDrawdownDays).toBe(2);
    expect(dd.singleDayMaxDrawdownPct).toBe(-20);
  });

  it('calculates win and loss streaks accurately', () => {
    const dailyReturns = [0.01, 0.02, 0.015, -0.01, -0.02, 0.03];
    const streaks = calculateStreakAnalysis(dailyReturns);
    expect(streaks.maxWinStreak).toBe(3);
    expect(streaks.maxLossStreak).toBe(2);
    expect(streaks.currentStreakCount).toBe(1);
    expect(streaks.currentStreakType).toBe('WIN');
  });

  it('builds full equity points with high/under performance regime', () => {
    const raw = [
      { date: '2026-09-01', equity: 10000, cash: 2000, invested: 8000, unrealizedPnL: 0, realizedPnLCumulative: 0 },
      { date: '2026-09-02', equity: 10500, cash: 2000, invested: 8500, unrealizedPnL: 500, realizedPnLCumulative: 0 },
      { date: '2026-09-03', equity: 11000, cash: 2000, invested: 9000, unrealizedPnL: 1000, realizedPnLCumulative: 0 },
    ];
    const result = buildEquityCurvePoints(raw);
    expect(result.points.length).toBe(3);
    expect(result.reversionAnalysis.isPositiveGrowth).toBe(true);

    const bars = equityPointsToOHLCVBars(result.points);
    expect(bars.length).toBe(3);
    expect(bars[0].close).toBe(10000);
  });

  describe('EXO Dynamic De-escalation Engine Tests (Verified with Excel)', () => {
    it('matches Excel line 18 values exactly (SPY entry 380.82, price 395.52)', () => {
      // Excel values:
      // Entry = 380.82, Stop = 370.82 (stop dist 10), Target = 430.82 (gain dist 50)
      // At Price 395.52:
      // unrealizedReturn = 14.70
      // maxCapitalArriesgado = 24.70
      // gananciaEsperada = 35.30
      // adjustedBR = 1.4291
      const res = calculateExoMetrics({
        symbol: 'SPY',
        entryPrice: 380.82,
        stopLossPrice: 370.82,
        targetPrice: 430.82,
        currentPrice: 395.52,
        shares: 1,
      });

      expect(res.unrealizedReturnPerUnit).toBeCloseTo(14.7, 1);
      expect(res.maxCapitalArriesgadoPerUnit).toBeCloseTo(24.7, 1);
      expect(res.gananciaEsperadaPerUnit).toBeCloseTo(35.3, 1);
      expect(res.adjustedBR).toBeCloseTo(1.429, 2);
      expect(res.recommendation).toBe('HOLD');
    });

    it('matches Excel line 33 values (SPY price 416.78, adjustedBR ~ 0.305, critical de-escalation)', () => {
      // At Price 416.78:
      // unrealizedReturn = 35.96
      // maxCapitalArriesgado = 45.96
      // gananciaEsperada = 14.04
      // adjustedBR = 0.30548 -> triggers SCALE_DOWN recommendation
      const res = calculateExoMetrics({
        symbol: 'SPY',
        entryPrice: 380.82,
        stopLossPrice: 370.82,
        targetPrice: 430.82,
        currentPrice: 416.78,
        shares: 1,
      });

      expect(res.adjustedBR).toBeCloseTo(0.305, 2);
      expect(res.recommendation).toBe('SCALE_DOWN');
    });
  });

  describe('VWAP Positional Engine Tests', () => {
    it('calculates weighted UTs correctly based on Doc 16-2 example', () => {
      // Doc 16-2 example:
      // 350 @ 2.46 = 860.1
      // 150 @ 2.70 = 405
      // 210 @ 3.099 = 650.79
      // 180 @ 3.91 = 703.8
      // 150 @ 5.00 = 750
      // Total = 1040 UTs, Avg = 3.24
      const execs = [
        { amount: 350, price: 2.46 },
        { amount: 150, price: 2.7 },
        { amount: 210, price: 3.099 },
        { amount: 180, price: 3.91 },
        { amount: 150, price: 5.0 },
      ];

      const res = calculatePositionVWAP(execs, 4.2, 3.5);
      expect(res.totalUnits).toBe(1040);
      expect(res.positionVwap).toBeCloseTo(3.24, 2);
      expect(res.marketVwapComparison?.isSuperiorExecution).toBe(true);
      expect(res.trendSignal.positionState).toBe('ABOVE_VWAP');
    });
  });

  describe('Risk & Return Metrics Tests', () => {
    it('calculates annualized volatility, Sharpe and Beta', () => {
      const portReturns = [0.01, -0.005, 0.012, 0.008, -0.002, 0.015];
      const benchReturns = [0.008, -0.004, 0.01, 0.005, -0.001, 0.012];

      const metrics = calculateRiskReturnMetrics({
        portfolioReturns: portReturns,
        benchmarkReturns: benchReturns,
        riskFreeRateAnnual: 0.04,
      });

      expect(metrics.annualizedVolatilityPct).toBeGreaterThan(0);
      expect(metrics.beta).toBeGreaterThan(0.5);
      expect(metrics.betaClassification).toBeDefined();
    });
  });
});
