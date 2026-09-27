export interface PositionalTradeExecution {
  amount: number;
  price: number;
  timestamp?: string;
}

export interface PositionalVwapResult {
  totalUnits: number;
  totalInvested: number;
  positionVwap: number;
  marketVwapComparison?: {
    marketVwap: number;
    efficiencyPct: number; // Positive means bought cheaper than market VWAP
    isSuperiorExecution: boolean;
  };
  trendSignal: {
    currentPrice: number;
    distanceToVwapPct: number;
    positionState: 'ABOVE_VWAP' | 'AT_VWAP' | 'BELOW_VWAP';
    role: 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL';
  };
}

/**
 * Calculates volume-weighted average price (VWAP) for position entries (ponderación de UTs).
 */
export function calculatePositionVWAP(
  executions: PositionalTradeExecution[],
  currentPrice: number,
  marketBenchmarkVwap?: number
): PositionalVwapResult {
  if (executions.length === 0) {
    return {
      totalUnits: 0,
      totalInvested: 0,
      positionVwap: currentPrice,
      trendSignal: {
        currentPrice,
        distanceToVwapPct: 0,
        positionState: 'AT_VWAP',
        role: 'NEUTRAL',
      },
    };
  }

  let totalUnits = 0;
  let totalInvested = 0;

  for (const exec of executions) {
    totalUnits += exec.amount;
    totalInvested += exec.amount * exec.price;
  }

  const positionVwap = totalUnits > 0 ? totalInvested / totalUnits : currentPrice;

  // Trend and role analysis
  const dist = positionVwap > 0 ? ((currentPrice - positionVwap) / positionVwap) * 100 : 0;
  let positionState: 'ABOVE_VWAP' | 'AT_VWAP' | 'BELOW_VWAP' = 'AT_VWAP';
  let role: 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL' = 'NEUTRAL';

  if (dist > 0.5) {
    positionState = 'ABOVE_VWAP';
    role = 'SUPPORT';
  } else if (dist < -0.5) {
    positionState = 'BELOW_VWAP';
    role = 'RESISTANCE';
  }

  let marketVwapComparison: PositionalVwapResult['marketVwapComparison'] = undefined;
  if (marketBenchmarkVwap && marketBenchmarkVwap > 0) {
    // Efficiency: (1 - (posVwap - marketVwap) / marketVwap) * 100
    // If we bought below market VWAP, execution is superior (> 100%)
    const efficiencyPct = ((marketBenchmarkVwap - positionVwap) / marketBenchmarkVwap) * 100;
    marketVwapComparison = {
      marketVwap: Math.round(marketBenchmarkVwap * 100) / 100,
      efficiencyPct: Math.round(efficiencyPct * 100) / 100,
      isSuperiorExecution: positionVwap <= marketBenchmarkVwap,
    };
  }

  return {
    totalUnits: Math.round(totalUnits * 1000) / 1000,
    totalInvested: Math.round(totalInvested * 100) / 100,
    positionVwap: Math.round(positionVwap * 100) / 100,
    marketVwapComparison,
    trendSignal: {
      currentPrice,
      distanceToVwapPct: Math.round(dist * 100) / 100,
      positionState,
      role,
    },
  };
}
