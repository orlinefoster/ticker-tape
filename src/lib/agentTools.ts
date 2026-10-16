import { usePortfolioStore } from '../store/portfolioStore';
import { useAuthStore } from '../store/authStore';
import { calculateDcaRebalance } from '../modules/spy_dca/engine';
import { DEFAULT_SECTOR_UNIVERSE, DcaPlanConfig, SectorAsset } from '../modules/spy_dca/types';

export interface CompactAgentPortfolioReport {
  timestamp: string;
  vault: {
    isUnlocked: boolean;
    user: string | null;
  };
  valuationUsd: {
    total: number;
    cash: number;
    iolCedears: number;
    crypto: number;
  };
  spyDcaSummary?: {
    monthlyDepositUsd: number;
    topOrders: { symbol: string; shares: number; costUsd: number }[];
    maxDriftSymbol: string;
    maxDriftPct: number;
  };
}

/**
 * Generates an ultra-dense, token-minimal portfolio status report (< 200 tokens)
 * designed specifically for AI agent consumption and fast decisions.
 */
export function getCompactPortfolioReport(): CompactAgentPortfolioReport {
  const auth = useAuthStore.getState();
  const portfolio = usePortfolioStore.getState();

  const total = portfolio.getTotalNetWorthUsd();
  const cash = portfolio.getCashValuationUsd();
  const iol = portfolio.getIOLValuationUsd();
  const crypto = portfolio.getBinanceValuationUsd();

  // Try to load SPY plan if available in localStorage
  let spyDcaSummary: CompactAgentPortfolioReport['spyDcaSummary'];
  try {
    const rawPlan = localStorage.getItem('spy_sectorial_dca_v1');
    if (rawPlan) {
      const parsed = JSON.parse(rawPlan);
      const assets: SectorAsset[] = parsed.assets || DEFAULT_SECTOR_UNIVERSE;
      const config: DcaPlanConfig = parsed.config || {
        monthlyDeposit: 150,
        currency: 'USD',
        driftTolerancePct: 2.0,
        expectedAnnualReturnPct: 9.5,
        cclRate: portfolio.rates.ccl || 1320,
      };

      const result = calculateDcaRebalance(assets, config);
      const topOrders = result.suggestedOrders
        .filter((o) => o.sharesToBuy > 0)
        .slice(0, 3)
        .map((o) => ({
          symbol: o.symbol,
          shares: o.sharesToBuy,
          costUsd: config.currency === 'ARS' ? Math.round(o.orderCost / (config.cclRate || 1320)) : o.orderCost,
        }));

      let maxDriftSymbol = 'NONE';
      let maxDriftPct = 0;
      for (const o of result.suggestedOrders) {
        if (Math.abs(o.driftPct) > Math.abs(maxDriftPct)) {
          maxDriftPct = o.driftPct;
          maxDriftSymbol = o.symbol;
        }
      }

      spyDcaSummary = {
        monthlyDepositUsd: config.currency === 'ARS' ? Math.round(config.monthlyDeposit / (config.cclRate || 1320)) : config.monthlyDeposit,
        topOrders,
        maxDriftSymbol,
        maxDriftPct,
      };
    }
  } catch {
    // Ignore if not present
  }

  return {
    timestamp: new Date().toISOString(),
    vault: {
      isUnlocked: auth.isUnlocked,
      user: auth.username,
    },
    valuationUsd: {
      total: Math.round(total * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      iolCedears: Math.round(iol * 100) / 100,
      crypto: Math.round(crypto * 100) / 100,
    },
    spyDcaSummary,
  };
}
