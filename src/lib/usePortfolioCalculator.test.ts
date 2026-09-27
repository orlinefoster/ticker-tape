import { describe, it, expect } from 'vitest';
import { calculatePortfolioMetrics } from './usePortfolioCalculator';
import type { CashHolding, IOLHolding, BinanceHolding } from '@/store/portfolioStore';

describe('usePortfolioCalculator - calculatePortfolioMetrics', () => {
  const mockRates = { ccl: 1250, mep: 1200, oficial: 1000 };

  it('calculates total net worth with zero holdings', () => {
    const metrics = calculatePortfolioMetrics([], [], [], mockRates);
    expect(metrics.totalNetWorthUsd).toBe(0);
    expect(metrics.totalNetWorthArs).toBe(0);
    expect(metrics.cashAllocationPct).toBe(0);
    expect(metrics.dryPowderStatus).toBe('OPTIMAL');
    expect(metrics.allocationBreakdown).toEqual([]);
  });

  it('accurately converts ARS and USD cash to USD net worth', () => {
    const cash: CashHolding[] = [
      { id: '1', institution: 'Banco Galicia', currency: 'ARS', amount: 1250000 }, // 1,250,000 / 1250 = $1,000 USD
      { id: '2', institution: 'Colchón', currency: 'USD', amount: 2000 },          // $2,000 USD
      { id: '3', institution: 'Banco Santander EUR', currency: 'EUR', amount: 500 }, // $540 USD
    ];

    const metrics = calculatePortfolioMetrics(cash, [], [], mockRates);
    expect(metrics.cashValuationUsd).toBe(3540);
    expect(metrics.totalNetWorthUsd).toBe(3540);
    expect(metrics.totalNetWorthArs).toBe(3540 * 1250);
    expect(metrics.cashAllocationPct).toBe(100);
    expect(metrics.dryPowderStatus).toBe('HIGH_CASH');
  });

  it('consolidates multi-asset portfolios across IOL CEDEARs, Binance, and Cash', () => {
    const cash: CashHolding[] = [
      { id: 'c1', institution: 'USD Cash', currency: 'USD', amount: 2000 },
    ];

    const iol: IOLHolding[] = [
      {
        id: 'i1',
        symbol: 'SPY',
        name: 'S&P 500 CEDEAR',
        assetType: 'CEDEAR',
        nominalQuantity: 100,
        avgBuyPriceArs: 10000,
        currentPriceArs: 12500, // 100 * 12500 = 1,250,000 ARS = $1,000 USD
        currencyExposure: 'USD_CCL',
      },
    ];

    const binance: BinanceHolding[] = [
      {
        id: 'b1',
        symbol: 'BTC',
        name: 'Bitcoin',
        amount: 0.1,
        avgBuyPriceUsdt: 60000,
        currentPriceUsdt: 70000, // 0.1 * 70000 = $7,000 USD
      },
    ];

    const metrics = calculatePortfolioMetrics(cash, iol, binance, mockRates);
    // Cash: 2,000; IOL: 1,000; Binance: 7,000 -> Total: 10,000 USD
    expect(metrics.cashValuationUsd).toBe(2000);
    expect(metrics.iolValuationUsd).toBe(1000);
    expect(metrics.binanceValuationUsd).toBe(7000);
    expect(metrics.totalNetWorthUsd).toBe(10000);
    expect(metrics.cashAllocationPct).toBe(20);
    expect(metrics.dryPowderStatus).toBe('OPTIMAL'); // Between 15% and 60%

    // Breakdown
    expect(metrics.allocationBreakdown).toHaveLength(3);
    const names = metrics.allocationBreakdown.map((b) => b.name);
    expect(names).toContain('Liquidez (Cash / USDT)');
    expect(names).toContain('CEDEARs (Renta Variable USA)');
    expect(names).toContain('Crypto Spot (Binance)');
  });

  it('detects low cash warning when dry powder is under 15%', () => {
    const cash: CashHolding[] = [{ id: 'c1', institution: 'Cash', currency: 'USD', amount: 500 }];
    const binance: BinanceHolding[] = [{ id: 'b1', symbol: 'BTC', name: 'Bitcoin', amount: 1, avgBuyPriceUsdt: 50000, currentPriceUsdt: 50000 }];

    const metrics = calculatePortfolioMetrics(cash, [], binance, mockRates);
    // 500 / 50500 < 1%
    expect(metrics.cashAllocationPct).toBeLessThan(15);
    expect(metrics.dryPowderStatus).toBe('LOW_CASH');
  });
});
