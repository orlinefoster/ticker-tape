import { describe, it, expect, beforeEach } from 'vitest';
import { usePortfolioStore } from './portfolioStore';

describe('portfolioStore', () => {
  beforeEach(() => {
    // Reset state before tests if needed
  });

  it('calculates portfolio valuations and net worth correctly', () => {
    const store = usePortfolioStore.getState();
    const cashUsd = store.getCashValuationUsd();
    const iolUsd = store.getIOLValuationUsd();
    const binanceUsd = store.getBinanceValuationUsd();
    const totalNetWorth = store.getTotalNetWorthUsd();

    expect(cashUsd).toBeGreaterThan(0);
    expect(iolUsd).toBeGreaterThan(0);
    expect(binanceUsd).toBeGreaterThan(0);
    expect(totalNetWorth).toBeCloseTo(cashUsd + iolUsd + binanceUsd, 2);
  });

  it('can update exchange rates and recalculate USD value of ARS holdings', () => {
    const store = usePortfolioStore.getState();
    const initialIolUsd = store.getIOLValuationUsd();
    
    // If CCL doubles, USD value of ARS portfolio halves
    store.setRates({ ccl: 2640 });
    const newIolUsd = usePortfolioStore.getState().getIOLValuationUsd();
    expect(newIolUsd).toBeCloseTo(initialIolUsd / 2, 1);

    // Reset rate
    store.setRates({ ccl: 1320 });
  });

  it('manages operational alerts', () => {
    const store = usePortfolioStore.getState();
    const initialAlertsCount = store.alerts.length;

    store.addAlert({
      severity: 'warning',
      portfolioType: 'binance',
      title: 'Test Alert',
      detail: 'Detail for test',
    });

    expect(usePortfolioStore.getState().alerts.length).toBe(initialAlertsCount + 1);

    const firstAlert = usePortfolioStore.getState().alerts[0];
    store.dismissAlert(firstAlert.id);
    expect(usePortfolioStore.getState().alerts.length).toBe(initialAlertsCount);
  });
});
