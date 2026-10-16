import { describe, it, expect } from 'vitest';
import { calculateDcaRebalance, projectCompoundWealth } from './engine';
import { DcaPlanConfig, SectorAsset } from './types';

describe('SPY DCA Engine', () => {
  const sampleConfig: DcaPlanConfig = {
    monthlyDeposit: 1000,
    currency: 'USD',
    driftTolerancePct: 2.0,
    expectedAnnualReturnPct: 10.0,
    cclRate: 1320,
  };

  it('calculates allocations for an initial empty portfolio', () => {
    const assets: SectorAsset[] = [
      {
        symbol: 'SPY',
        name: 'SPY Core',
        category: 'core',
        targetWeightPct: 60,
        currentQuantity: 0,
        currentPriceUsd: 100,
        currentPriceArs: 132000,
        description: 'Core',
      },
      {
        symbol: 'XLK',
        name: 'Tech',
        category: 'satellite',
        targetWeightPct: 40,
        currentQuantity: 0,
        currentPriceUsd: 50,
        currentPriceArs: 66000,
        description: 'Tech',
      },
    ];

    const result = calculateDcaRebalance(assets, sampleConfig);

    expect(result.totalCurrentValue).toBe(0);
    expect(result.allocatedAmount).toBe(1000);
    expect(result.remainingCash).toBe(0);

    const spyOrder = result.suggestedOrders.find((o) => o.symbol === 'SPY');
    const xlkOrder = result.suggestedOrders.find((o) => o.symbol === 'XLK');

    expect(spyOrder?.sharesToBuy).toBe(6); // 6 * 100 = 600 (60%)
    expect(xlkOrder?.sharesToBuy).toBe(8); // 8 * 50 = 400 (40%)
    expect(spyOrder?.projectedWeightPct).toBe(60);
    expect(xlkOrder?.projectedWeightPct).toBe(40);
  });

  it('rebalances underweight assets when one sector is lagging', () => {
    // Current portfolio: SPY had a huge rally and is overweight (90%), XLK is lagging (10%)
    const assets: SectorAsset[] = [
      {
        symbol: 'SPY',
        name: 'SPY Core',
        category: 'core',
        targetWeightPct: 50,
        currentQuantity: 9,
        currentPriceUsd: 100, // 9 * 100 = $900
        currentPriceArs: 132000,
        description: 'Core',
      },
      {
        symbol: 'XLK',
        name: 'Tech',
        category: 'satellite',
        targetWeightPct: 50,
        currentQuantity: 2,
        currentPriceUsd: 50, // 2 * 50 = $100
        currentPriceArs: 66000,
        description: 'Tech',
      },
    ];

    // Deposit $500
    const config: DcaPlanConfig = {
      ...sampleConfig,
      monthlyDeposit: 500,
    };

    const result = calculateDcaRebalance(assets, config);

    expect(result.totalCurrentValue).toBe(1000); // 900 + 100

    const spyOrder = result.suggestedOrders.find((o) => o.symbol === 'SPY');
    const xlkOrder = result.suggestedOrders.find((o) => o.symbol === 'XLK');

    // Smart DCA should channel almost all funds into underweight XLK to bring it closer to 50%
    expect(xlkOrder?.status).toBe('underweight');
    expect(spyOrder?.status).toBe('overweight');
    expect(xlkOrder?.sharesToBuy).toBeGreaterThan(0);
    expect(xlkOrder?.projectedWeightPct).toBeGreaterThan(xlkOrder?.currentWeightPct || 0);
  });

  it('projects compound wealth over 10 years accurately', () => {
    const projection = projectCompoundWealth(0, 100, 10, 10);

    expect(projection.length).toBeGreaterThan(0);
    const year10 = projection[projection.length - 1];

    expect(year10.year).toBe(10);
    expect(year10.totalContributions).toBe(12000); // 100 * 12 * 10
    expect(year10.projectedPortfolioValue).toBeGreaterThan(12000);
    expect(year10.compoundGains).toBeGreaterThan(0);
  });
});
