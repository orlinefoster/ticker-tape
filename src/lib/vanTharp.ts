/**
 * Van Tharp Position Sizing & Risk Management Engine
 * Implements R-Multiple sizing, fixed fractional risk, ATR stop calculations,
 * and System Quality Number (SQN) metrics.
 */

export interface PositionSizeParams {
  totalEquity: number; // Total account or portfolio equity ($)
  riskPercentage: number; // e.g., 1.0 = 1% risk per trade
  entryPrice: number; // Expected execution price
  stopLossPrice: number; // Hard stop level
  targetPrice?: number; // Target take profit level
  assetType?: 'ACCION' | 'CEDEAR' | 'CRIPTO' | 'BONO';
}

export interface PositionSizeResult {
  riskPerShare: number; // $R per unit (Entry - Stop)
  riskPerSharePct: number; // % drop to stop loss
  totalRiskAmount: number; // 1R in dollars ($)
  recommendedQuantity: number; // Units/shares to buy
  totalCapitalRequired: number; // Total value of the position ($)
  portfolioAllocationPct: number; // % of total portfolio needed
  rMultipleTarget?: number; // Expected R return if target reached
  riskRewardRatio?: number; // Target / Risk ratio
  isOverallocated: boolean; // True if position size exceeds available equity
  warningMessage?: string;
}

export interface TradeRResult {
  tradeId: string;
  symbol: string;
  rMultiple: number; // Profit or loss expressed as a multiple of 1R (e.g. +2.5R, -1.0R)
}

/**
 * Calculates position size based on Van Tharp's Fixed Fractional % Risk model.
 * Formula: Quantity = (Equity * Risk%) / (Entry - StopLoss)
 */
export function calculatePositionSize(params: PositionSizeParams): PositionSizeResult {
  const { totalEquity, riskPercentage, entryPrice, stopLossPrice, targetPrice } = params;

  if (entryPrice <= 0 || stopLossPrice <= 0 || totalEquity <= 0) {
    return {
      riskPerShare: 0,
      riskPerSharePct: 0,
      totalRiskAmount: 0,
      recommendedQuantity: 0,
      totalCapitalRequired: 0,
      portfolioAllocationPct: 0,
      isOverallocated: false,
      warningMessage: 'Precios de entrada y stop loss deben ser mayores a cero.',
    };
  }

  const riskPerShare = Math.abs(entryPrice - stopLossPrice);
  const riskPerSharePct = (riskPerShare / entryPrice) * 100;
  const totalRiskAmount = (totalEquity * (riskPercentage / 100));

  if (riskPerShare === 0) {
    return {
      riskPerShare: 0,
      riskPerSharePct: 0,
      totalRiskAmount,
      recommendedQuantity: 0,
      totalCapitalRequired: 0,
      portfolioAllocationPct: 0,
      isOverallocated: false,
      warningMessage: 'El precio de stop loss no puede ser igual al de entrada.',
    };
  }

  // Exact quantity based on 1R risk budget
  let exactQuantity = totalRiskAmount / riskPerShare;

  // Round down for whole shares (CEDEARs / stocks) or keep decimals for crypto
  const recommendedQuantity =
    params.assetType === 'CRIPTO' ? parseFloat(exactQuantity.toFixed(4)) : Math.floor(exactQuantity);

  const totalCapitalRequired = recommendedQuantity * entryPrice;
  const portfolioAllocationPct = (totalCapitalRequired / totalEquity) * 100;
  const isOverallocated = totalCapitalRequired > totalEquity;

  let rMultipleTarget: number | undefined;
  let riskRewardRatio: number | undefined;

  if (targetPrice && targetPrice > entryPrice) {
    const profitPerShare = targetPrice - entryPrice;
    rMultipleTarget = parseFloat((profitPerShare / riskPerShare).toFixed(2));
    riskRewardRatio = rMultipleTarget;
  }

  let warningMessage: string | undefined;
  if (isOverallocated) {
    warningMessage = `¡Atención! La orden requiere el ${portfolioAllocationPct.toFixed(0)}% del capital para respetar el stop loss holgado. Reducí el tamaño o ajustá el stop loss.`;
  } else if (portfolioAllocationPct > 25) {
    warningMessage = `Concentración alta: la posición ocupará el ${portfolioAllocationPct.toFixed(1)}% de tu cartera.`;
  }

  return {
    riskPerShare: parseFloat(riskPerShare.toFixed(2)),
    riskPerSharePct: parseFloat(riskPerSharePct.toFixed(2)),
    totalRiskAmount: parseFloat(totalRiskAmount.toFixed(2)),
    recommendedQuantity: Math.max(0, recommendedQuantity),
    totalCapitalRequired: parseFloat(totalCapitalRequired.toFixed(2)),
    portfolioAllocationPct: parseFloat(portfolioAllocationPct.toFixed(2)),
    rMultipleTarget,
    riskRewardRatio,
    isOverallocated,
    warningMessage,
  };
}

/**
 * Calculates Van Tharp's System Quality Number (SQN).
 * SQN = (Mean R / StdDev R) * sqrt(min(N, 100))
 * Benchmarks:
 * < 1.6 : Hard to trade
 * 1.6 - 1.9 : Average system
 * 2.0 - 2.4 : Good system
 * 2.5 - 2.9 : Excellent system
 * 3.0 - 5.0 : Superb system
 * 5.0 - 7.0 : Holy Grail system
 */
export function calculateSQN(tradesR: number[]): {
  sqn: number;
  meanR: number;
  stdDevR: number;
  tradesCount: number;
  rating: string;
} {
  const n = tradesR.length;
  if (n < 5) {
    return {
      sqn: 0,
      meanR: 0,
      stdDevR: 0,
      tradesCount: n,
      rating: 'Insuficientes operaciones (mínimo 5 requeridas)',
    };
  }

  const sum = tradesR.reduce((acc, val) => acc + val, 0);
  const meanR = sum / n;

  const variance = tradesR.reduce((acc, val) => acc + Math.pow(val - meanR, 2), 0) / (n - 1);
  const stdDevR = Math.sqrt(variance);

  if (stdDevR === 0) {
    return {
      sqn: 0,
      meanR,
      stdDevR: 0,
      tradesCount: n,
      rating: 'Desvío estándar nulo',
    };
  }

  const sqn = (meanR / stdDevR) * Math.sqrt(Math.min(n, 100));

  let rating = 'Promedio (1.6 - 1.9)';
  if (sqn < 1.6) rating = 'Difícil de operar (< 1.6)';
  else if (sqn >= 2.0 && sqn < 2.5) rating = 'Buen sistema (2.0 - 2.4)';
  else if (sqn >= 2.5 && sqn < 3.0) rating = 'Excelente sistema (2.5 - 2.9)';
  else if (sqn >= 3.0 && sqn < 5.0) rating = 'Soberbio / Elite (3.0 - 4.9)';
  else if (sqn >= 5.0) rating = 'Santo Grial (≥ 5.0)';

  return {
    sqn: parseFloat(sqn.toFixed(2)),
    meanR: parseFloat(meanR.toFixed(2)),
    stdDevR: parseFloat(stdDevR.toFixed(2)),
    tradesCount: n,
    rating,
  };
}
