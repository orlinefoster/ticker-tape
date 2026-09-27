import { useMemo } from 'react';
import { usePortfolioStore, type IOLHolding, type BinanceHolding, type CashHolding } from '@/store/portfolioStore';
import { useServiceStatusStore } from '@/store/serviceStatusStore';

export interface AssetAllocationItem {
  name: string;
  valueUsd: number;
  percentage: number;
  color: string;
}

export interface PortfolioCalculations {
  totalNetWorthUsd: number;
  totalNetWorthArs: number;
  cashValuationUsd: number;
  cashValuationArs: number;
  iolValuationUsd: number;
  iolValuationArs: number;
  binanceValuationUsd: number;
  cashAllocationPct: number;
  investedAllocationPct: number;
  allocationBreakdown: AssetAllocationItem[];
  dryPowderStatus: 'OPTIMAL' | 'LOW_CASH' | 'HIGH_CASH';
}

const ALLOCATION_COLORS = {
  cash: '#10B981',       // Emerald
  cedears: '#3B82F6',    // Blue
  bonos: '#F59E0B',      // Amber
  crypto: '#8B5CF6',     // Purple
  acciones: '#EC4899',   // Pink
  other: '#64748B',      // Slate
};

/**
 * Pure calculation function for testability without React runtime dependency.
 */
export function calculatePortfolioMetrics(
  cashHoldings: CashHolding[],
  iolHoldings: IOLHolding[],
  binanceHoldings: BinanceHolding[],
  rates: { ccl: number; mep: number; oficial: number }
): PortfolioCalculations {
  const ccl = rates.ccl > 0 ? rates.ccl : 1250;

  // 1. Cash Valuations
  const cashValuationUsd = cashHoldings.reduce((acc, c) => {
    if (c.currency === 'USD') return acc + c.amount;
    if (c.currency === 'EUR') return acc + c.amount * 1.08;
    return acc + c.amount / ccl;
  }, 0);

  const cashValuationArs = cashValuationUsd * ccl;

  // 2. IOL Valuations
  let iolValuationUsd = 0;
  let iolValuationArs = 0;
  for (const h of iolHoldings) {
    const totalArs = h.nominalQuantity * h.currentPriceArs;
    iolValuationArs += totalArs;
    iolValuationUsd += totalArs / ccl;
  }

  // 3. Binance Valuations
  let binanceValuationUsd = 0;
  for (const b of binanceHoldings) {
    binanceValuationUsd += b.amount * b.currentPriceUsdt;
  }

  // 4. Consolidated Net Worth
  const totalNetWorthUsd = cashValuationUsd + iolValuationUsd + binanceValuationUsd;
  const totalNetWorthArs = totalNetWorthUsd * ccl;

  // 5. Percentages
  const cashAllocationPct = totalNetWorthUsd > 0 ? (cashValuationUsd / totalNetWorthUsd) * 100 : 0;
  const investedAllocationPct = totalNetWorthUsd > 0 ? 100 - cashAllocationPct : 0;

  // 6. Granular Breakdown by Asset Class
  const cedearsValUsd = iolHoldings
    .filter((h) => h.assetType === 'CEDEAR')
    .reduce((acc, h) => acc + (h.nominalQuantity * h.currentPriceArs) / ccl, 0);

  const bonosValUsd = iolHoldings
    .filter((h) => h.assetType === 'BONO_SOBERANO' || h.assetType === 'ON_CORPORATIVA')
    .reduce((acc, h) => acc + (h.nominalQuantity * h.currentPriceArs) / ccl, 0);

  const localStocksValUsd = iolHoldings
    .filter((h) => h.assetType === 'ACCION_LOCAL' || h.assetType === 'FCI_CAUCION')
    .reduce((acc, h) => acc + (h.nominalQuantity * h.currentPriceArs) / ccl, 0);

  const breakdown: AssetAllocationItem[] = [];

  if (totalNetWorthUsd > 0) {
    if (cashValuationUsd > 0) {
      breakdown.push({
        name: 'Liquidez (Cash / USDT)',
        valueUsd: cashValuationUsd,
        percentage: (cashValuationUsd / totalNetWorthUsd) * 100,
        color: ALLOCATION_COLORS.cash,
      });
    }
    if (cedearsValUsd > 0) {
      breakdown.push({
        name: 'CEDEARs (Renta Variable USA)',
        valueUsd: cedearsValUsd,
        percentage: (cedearsValUsd / totalNetWorthUsd) * 100,
        color: ALLOCATION_COLORS.cedears,
      });
    }
    if (binanceValuationUsd > 0) {
      breakdown.push({
        name: 'Crypto Spot (Binance)',
        valueUsd: binanceValuationUsd,
        percentage: (binanceValuationUsd / totalNetWorthUsd) * 100,
        color: ALLOCATION_COLORS.crypto,
      });
    }
    if (bonosValUsd > 0) {
      breakdown.push({
        name: 'Renta Fija & ONs',
        valueUsd: bonosValUsd,
        percentage: (bonosValUsd / totalNetWorthUsd) * 100,
        color: ALLOCATION_COLORS.bonos,
      });
    }
    if (localStocksValUsd > 0) {
      breakdown.push({
        name: 'Acciones BYMA / FCI',
        valueUsd: localStocksValUsd,
        percentage: (localStocksValUsd / totalNetWorthUsd) * 100,
        color: ALLOCATION_COLORS.acciones,
      });
    }
  }

  // 7. Money Management - Dry Powder Status
  let dryPowderStatus: 'OPTIMAL' | 'LOW_CASH' | 'HIGH_CASH' = 'OPTIMAL';
  if (totalNetWorthUsd === 0) {
    dryPowderStatus = 'OPTIMAL';
  } else if (cashAllocationPct < 15) {
    dryPowderStatus = 'LOW_CASH';
  } else if (cashAllocationPct > 60) {
    dryPowderStatus = 'HIGH_CASH';
  }

  return {
    totalNetWorthUsd,
    totalNetWorthArs,
    cashValuationUsd,
    cashValuationArs,
    iolValuationUsd,
    iolValuationArs,
    binanceValuationUsd,
    cashAllocationPct,
    investedAllocationPct,
    allocationBreakdown: breakdown,
    dryPowderStatus,
  };
}

/**
 * Custom React Hook providing memoized portfolio calculations.
 * Adheres to Single Responsibility & Dependency Inversion Principles.
 */
export function usePortfolioCalculator(): PortfolioCalculations {
  const { cashHoldings, iolHoldings, binanceHoldings, rates } = usePortfolioStore();
  const { override } = useServiceStatusStore();
  const isReal = override === 'Real';

  // In Real mode, simulated sandbox holdings are isolated and reset to zero unless real connected assets exist
  const effectiveCash = isReal ? [] : cashHoldings;
  const effectiveIol = isReal ? [] : iolHoldings;
  const effectiveBinance = isReal ? [] : binanceHoldings;

  return useMemo(
    () => calculatePortfolioMetrics(effectiveCash, effectiveIol, effectiveBinance, rates),
    [effectiveCash, effectiveIol, effectiveBinance, rates]
  );
}
