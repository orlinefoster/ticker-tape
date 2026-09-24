import { describe, it, expect } from 'vitest';
import { calculatePositionSize, calculateSQN } from './vanTharp';

describe('vanTharp position sizing', () => {
  it('calculates position size correctly with fixed fractional risk', () => {
    // Total equity $100,000, 1% risk ($1,000). Entry $100, Stop Loss $90 ($10 risk/share)
    // Quantity should be 100 shares. Total capital required $10,000 (10% allocation)
    const result = calculatePositionSize({
      totalEquity: 100000,
      riskPercentage: 1.0,
      entryPrice: 100,
      stopLossPrice: 90,
      targetPrice: 130, // +$30 profit = 3R
      assetType: 'ACCION',
    });

    expect(result.riskPerShare).toBe(10);
    expect(result.totalRiskAmount).toBe(1000);
    expect(result.recommendedQuantity).toBe(100);
    expect(result.totalCapitalRequired).toBe(10000);
    expect(result.portfolioAllocationPct).toBe(10);
    expect(result.rMultipleTarget).toBe(3);
    expect(result.isOverallocated).toBe(false);
  });

  it('detects overallocation when stop loss is too tight or risk is too high', () => {
    // Total equity $10,000, 2% risk ($200). Entry $100, Stop Loss $99 ($1 risk/share)
    // 200 shares * $100 = $20,000 required (200% of account) -> Overallocated!
    const result = calculatePositionSize({
      totalEquity: 10000,
      riskPercentage: 2.0,
      entryPrice: 100,
      stopLossPrice: 99,
      assetType: 'CEDEAR',
    });

    expect(result.recommendedQuantity).toBe(200);
    expect(result.totalCapitalRequired).toBe(20000);
    expect(result.isOverallocated).toBe(true);
    expect(result.warningMessage).toContain('¡Atención!');
  });

  it('calculates Van Tharp SQN (System Quality Number) accurately', () => {
    // 10 trades in R multiples
    const sampleR = [2.0, -1.0, 3.5, -1.0, 1.5, -0.5, 4.0, -1.0, 2.5, -1.0];
    const sqnStats = calculateSQN(sampleR);

    expect(sqnStats.tradesCount).toBe(10);
    expect(sqnStats.meanR).toBeGreaterThan(0);
    expect(sqnStats.sqn).toBeGreaterThan(1.0);
    expect(sqnStats.rating).toBeDefined();
  });
});
