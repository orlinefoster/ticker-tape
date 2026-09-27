export interface ExoTradeParams {
  symbol: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  currentPrice: number;
  shares: number;
}

export type ExoActionRecommendation =
  | 'ALLOW_SCALE_UP' // BR >= 2.0: Growth stage, can add on healthy pullbacks
  | 'HOLD'           // 1.0 <= BR < 2.0: Balanced stage, hold position
  | 'TIGHTEN_STOP'   // 0.5 <= BR < 1.0: Caution, trail stop to breakeven or above
  | 'SCALE_DOWN';    // BR < 0.5: Critical asymmetry, take partial profit (30-50%)

export interface ExoMetricsResult {
  symbol: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  currentPrice: number;
  shares: number;

  initialRiskPerUnit: number;
  initialRewardPerUnit: number;
  initialBR: number;

  unrealizedReturnPerUnit: number;
  unrealizedReturnTotal: number;
  maxCapitalArriesgadoPerUnit: number;
  maxCapitalArriesgadoTotal: number;
  gananciaEsperadaPerUnit: number;
  gananciaEsperadaTotal: number;

  adjustedBR: number;
  progressToTargetPct: number;
  recommendation: ExoActionRecommendation;
  recommendationLabel: string;
  recommendationColor: string;
  suggestedActionText: string;
}

export interface ExoHistoricalStep {
  date: string;
  price: number;
  unrealizedReturn: number;
  maxCapitalArriesgado: number;
  gananciaEsperada: number;
  adjustedBR: number;
}

/**
 * Calculates dynamic Adjusted Benefit/Risk (EXO model) for a given position.
 */
export function calculateExoMetrics(params: ExoTradeParams): ExoMetricsResult {
  const { symbol, entryPrice, stopLossPrice, targetPrice, currentPrice, shares } = params;

  const isLong = targetPrice >= entryPrice;
  const initialRiskPerUnit = Math.abs(entryPrice - stopLossPrice);
  const initialRewardPerUnit = Math.abs(targetPrice - entryPrice);
  const initialBR = initialRiskPerUnit > 0 ? initialRewardPerUnit / initialRiskPerUnit : 0;

  const unrealizedReturnPerUnit = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  const unrealizedReturnTotal = unrealizedReturnPerUnit * shares;

  // Max capital arriesgado = initial risk + unrealized profit = distance from current price to stop
  const maxCapitalArriesgadoPerUnit = Math.max(0.0001, isLong ? currentPrice - stopLossPrice : stopLossPrice - currentPrice);
  const maxCapitalArriesgadoTotal = maxCapitalArriesgadoPerUnit * shares;

  // Ganancia esperada = remaining distance from current price to target
  const gananciaEsperadaPerUnit = Math.max(0, isLong ? targetPrice - currentPrice : currentPrice - targetPrice);
  const gananciaEsperadaTotal = gananciaEsperadaPerUnit * shares;

  const adjustedBR = maxCapitalArriesgadoPerUnit > 0 ? gananciaEsperadaPerUnit / maxCapitalArriesgadoPerUnit : 0;

  const totalDistance = Math.abs(targetPrice - entryPrice);
  const coveredDistance = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  const progressToTargetPct = totalDistance > 0 ? Math.min(100, Math.max(0, (coveredDistance / totalDistance) * 100)) : 0;

  let recommendation: ExoActionRecommendation = 'HOLD';
  let recommendationLabel = 'MANTENER (ZONA EQUILIBRADA)';
  let recommendationColor = '#00F5D4'; // Mint
  let suggestedActionText = 'El ratio B/R ajustado sigue en zona neutral. Mantener posición sin ajustes.';

  if (adjustedBR >= 2.0) {
    recommendation = 'ALLOW_SCALE_UP';
    recommendationLabel = 'PERMITIDO ESCALAR (FASE TEMPRANA)';
    recommendationColor = '#00E5FF'; // Cyan
    suggestedActionText = 'El ratio B/R permanece altamente favorable. Es viable añadir UTs (escalar) si el precio realiza un pullback al VWAP o soporte.';
  } else if (adjustedBR >= 1.0) {
    recommendation = 'HOLD';
    recommendationLabel = 'MANTENER (ZONA EQUILIBRADA)';
    recommendationColor = '#FFE082'; // Gold
    suggestedActionText = 'La operación madura normalmente. Relación riesgo/beneficio equilibrada.';
  } else if (adjustedBR >= 0.5) {
    recommendation = 'TIGHTEN_STOP';
    recommendationLabel = 'ALERTA: CEÑIR STOP (DESESCALAR RIESGO)';
    recommendationColor = '#FF9100'; // Amber
    suggestedActionText = 'Estás arriesgando más ganancia acumulada de lo que queda por ganar. Se sugiere subir Stop Loss a Breakeven o trailing.';
  } else {
    recommendation = 'SCALE_DOWN';
    recommendationLabel = 'DESESCALAMIENTO CRÍTICO (TOMA PARCIAL)';
    recommendationColor = '#FF3366'; // Crimson
    suggestedActionText = 'Asimetría severa: el B/R cayó por debajo de 0.5. Se recomienda toma de beneficios parcial (30% - 50%) para bloquear utilidades.';
  }

  return {
    symbol,
    entryPrice,
    stopLossPrice,
    targetPrice,
    currentPrice,
    shares,
    initialRiskPerUnit: Math.round(initialRiskPerUnit * 100) / 100,
    initialRewardPerUnit: Math.round(initialRewardPerUnit * 100) / 100,
    initialBR: Math.round(initialBR * 100) / 100,
    unrealizedReturnPerUnit: Math.round(unrealizedReturnPerUnit * 100) / 100,
    unrealizedReturnTotal: Math.round(unrealizedReturnTotal * 100) / 100,
    maxCapitalArriesgadoPerUnit: Math.round(maxCapitalArriesgadoPerUnit * 100) / 100,
    maxCapitalArriesgadoTotal: Math.round(maxCapitalArriesgadoTotal * 100) / 100,
    gananciaEsperadaPerUnit: Math.round(gananciaEsperadaPerUnit * 100) / 100,
    gananciaEsperadaTotal: Math.round(gananciaEsperadaTotal * 100) / 100,
    adjustedBR: Math.round(adjustedBR * 1000) / 1000,
    progressToTargetPct: Math.round(progressToTargetPct * 10) / 10,
    recommendation,
    recommendationLabel,
    recommendationColor,
    suggestedActionText,
  };
}

/**
 * Computes the historical evolution series of adjusted B/R over an array of close prices.
 */
export function computeExoTrajectory(
  entryPrice: number,
  stopPrice: number,
  targetPrice: number,
  priceHistory: { date: string; close: number }[]
): ExoHistoricalStep[] {
  return priceHistory.map((item) => {
    const p = item.close;
    const unrealized = p - entryPrice;
    const maxRisk = p - stopPrice;
    const expectedGain = Math.max(0, targetPrice - p);
    const adjBR = maxRisk > 0 ? expectedGain / maxRisk : 0;

    return {
      date: item.date,
      price: p,
      unrealizedReturn: Math.round(unrealized * 100) / 100,
      maxCapitalArriesgado: Math.round(maxRisk * 100) / 100,
      gananciaEsperada: Math.round(expectedGain * 100) / 100,
      adjustedBR: Math.round(adjBR * 1000) / 1000,
    };
  });
}
