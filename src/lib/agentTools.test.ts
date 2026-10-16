import { describe, it, expect, beforeEach } from 'vitest';
import { getCompactPortfolioReport } from './agentTools';
import { useAuthStore } from '../store/authStore';
import { usePortfolioStore } from '../store/portfolioStore';

describe('agentTools - getCompactPortfolioReport', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      isUnlocked: true,
      username: 'TestUser',
    });
    usePortfolioStore.setState({
      cashHoldings: [{ id: 'c1', currency: 'USD', amount: 500, institution: 'Cash' }],
      iolHoldings: [],
      binanceHoldings: [],
      rates: { ccl: 1300, mep: 1280, oficial: 1000 },
    });
  });

  it('generates a compact report without throwing', () => {
    const report = getCompactPortfolioReport();

    expect(report.vault.isUnlocked).toBe(true);
    expect(report.vault.user).toBe('TestUser');
    expect(report.valuationUsd.cash).toBe(500);
    expect(report.valuationUsd.total).toBe(500);
    expect(report.timestamp).toBeDefined();
  });
});
