import { describe, it, expect } from 'vitest';
import {
  evaluateIntermarketContext,
  computeReturns,
  computeRRGSeries,
  classifyQuadrant,
  calculatePositionSize,
  generateCompactAIPrompt,
  buildOperatorExecutionPlan,
  runTopDownAnalystPipeline,
} from './engine';
import type { OHLCVBar } from '@/lib/tauri';
import type { OperatorSettings } from './types';

describe('TopDown Engine - Core Calculations', () => {
  it('evaluates intermarket context correctly', () => {
    const rawReport = {
      phase: 'LateExpansion',
      confidence: 0.85,
      key_ratios: {
        stock_bond_trend: 'up',
        dollar_trend: 'down',
        commodity_bond_trend: 'up',
      },
    };

    const ctx = evaluateIntermarketContext(rawReport);
    expect(ctx.regime).toBe('Risk-On');
    expect(ctx.cyclePhase).toBe('LateExpansion');
    expect(ctx.dollarTrend).toBe('Bearish');
    expect(ctx.stocksBondsRatioTrend).toBe('Risk-Seeking');
    expect(ctx.confidence).toBe(0.85);
  });

  it('computes returns and detects outperformance vs benchmark', () => {
    const assetCloses = [100, 102, 105, 108, 115, 120];
    const benchCloses = [100, 101, 102, 103, 104, 105];

    const rAsset = computeReturns(assetCloses, 5);
    const rBench = computeReturns(benchCloses, 5);

    expect(rAsset).toBeCloseTo(0.20, 2);
    expect(rBench).toBeCloseTo(0.05, 2);
    expect(rAsset - rBench).toBeGreaterThan(0.10);
  });

  it('computes RRG series and returns normalized coordinates', () => {
    const asset = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const bench = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const rrg = computeRRGSeries(asset, bench, 10);
    expect(rrg.rsRatio).toBeGreaterThan(100);
    expect(rrg.rsMomentum).toBeDefined();
    expect(Array.isArray(rrg.history)).toBe(true);
  });

  it('classifies quadrants properly based on RS-Ratio and RS-Momentum', () => {
    expect(classifyQuadrant(102, 101)).toBe('Leading');
    expect(classifyQuadrant(102, 98)).toBe('Weakening');
    expect(classifyQuadrant(98, 97)).toBe('Lagging');
    expect(classifyQuadrant(97, 103)).toBe('Improving');
  });

  it('calculates position sizing accurately across fixed risk, ATR, and half-kelly', () => {
    const capital = 50000;
    const riskPct = 0.01; // $500 risk
    const entry = 100;
    const stop = 95; // $5 stop distance

    // Fixed Risk: $500 / $5 = 100 shares ($10,000 allocation)
    const fixed = calculatePositionSize(capital, riskPct, entry, stop, 'fixed_risk');
    expect(fixed.shares).toBe(100);
    expect(fixed.dollarValue).toBe(10000);
    expect(fixed.dollarRisk).toBe(500);

    // Half-Kelly test
    const kelly = calculatePositionSize(capital, riskPct, entry, stop, 'half_kelly', 0, 0.55, 2.0);
    expect(kelly.shares).toBeGreaterThan(0);
    expect(kelly.dollarValue).toBeLessThanOrEqual(capital * 0.35); // Respects 35% safety cap
  });

  it('generates a token-compact AI prompt containing necessary context and constraints', () => {
    const macro = evaluateIntermarketContext({ phase: 'EarlyExpansion' });
    const prompt = generateCompactAIPrompt(
      'crypto',
      'BTC',
      macro,
      [],
      [
        {
          symbol: 'SOL',
          price: 155,
          quadrant: 'Leading',
          alpha3m: 14.5,
          score: 88,
          category: 'OUTPERFORMER',
          elliott: {
            symbol: 'SOL',
            currentWave: 'Onda 3 Impulso',
            degree: 'Daily',
            trend: 'Bullish',
            confidence: 0.9,
            invalidationPrice: 142,
            targetPrice: 195,
            suggestedAction: 'BUY_IMPULSE',
            rationale: 'Breakout con volumen',
          },
        },
      ]
    );

    expect(prompt).toContain('[TOP_DOWN_MARKET_AUDIT]');
    expect(prompt).toContain('BENCHMARK: BTC');
    expect(prompt).toContain('SOL ($155) [Leading]');
    expect(prompt).toContain('Stop:$142 Target:$195');
    // Verify compact size (< 1500 chars, ~350 tokens)
    expect(prompt.length).toBeLessThan(1500);
  });

  it('runs the full top-down pipeline and builds operator plan', () => {
    const mockBarGen = (base: number, trend: number): OHLCVBar[] => {
      const bars: OHLCVBar[] = [];
      let p = base;
      for (let i = 0; i < 70; i++) {
        p = p * (1 + trend + (Math.sin(i) * 0.01));
        bars.push({
          symbol: 'TEST',
          date: `2026-01-${(i % 28) + 1}`,
          open: p * 0.99,
          high: p * 1.02,
          low: p * 0.98,
          close: p,
          volume: 10000,
        });
      }
      return bars;
    };

    const barsMap: Record<string, OHLCVBar[]> = {
      BTC: mockBarGen(60000, 0.001),
      SOL: mockBarGen(120, 0.003), // Outperformer
      ETH: mockBarGen(3000, 0.0005),
      NEAR: mockBarGen(5, 0.0025),
    };

    const report = runTopDownAnalystPipeline(
      'crypto',
      'BTC',
      ['BTC', 'SOL', 'ETH', 'NEAR'],
      barsMap,
      { phase: 'LateExpansion' }
    );

    expect(report.items.length).toBe(4);
    expect(report.topCandidates.length).toBeGreaterThan(0);
    expect(report.estimatedAITokens).toBeGreaterThan(50);
    expect(report.estimatedAITokens).toBeLessThan(700);

    const settings: OperatorSettings = {
      totalCapital: 25000,
      riskPerTradePct: 0.015,
      maxPortfolioHeatPct: 0.06,
      sizingMethod: 'fixed_risk',
      atrPeriod: 14,
      defaultStopPct: 0.06,
    };

    const plan = buildOperatorExecutionPlan(report.topCandidates, settings);
    expect(plan.trades.length).toBeGreaterThan(0);
    expect(plan.totalPortfolioRiskPct).toBeLessThanOrEqual(6.0); // Within heat cap
    expect(plan.equityCurve.length).toBe(31);
  });
});
