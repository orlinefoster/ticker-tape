export interface RiskReturnInputs {
  portfolioReturns: number[]; // Daily returns (e.g. 0.01 for 1%)
  benchmarkReturns: number[]; // Daily returns of benchmark (e.g. SPY)
  riskFreeRateAnnual?: number; // e.g. 0.045 for 4.5%
  inflationRateAnnual?: number; // e.g. 0.03 for 3.0%
  currencyDevaluationAnnual?: number; // e.g. 0.02 for 2.0%
}

export interface RiskReturnMetrics {
  // Volatility & Risk
  dailyVolatilityPct: number;
  annualizedVolatilityPct: number;
  downsideVolatilityPct: number;
  beta: number;
  betaClassification: 'DEFENSIVE' | 'NEUTRAL' | 'AGGRESSIVE';
  riskPremiumPct: number;

  // Performance Ratios
  annualizedReturnPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  treynorRatio: number;
  jensensAlphaPct: number;
  paolucciRatio: number;

  // Real Return Breakdown
  excessReturnOverBenchmarkPct: number;
  realReturnNetPct: number;
  isRealGainPositive: boolean;
}

/**
 * Calculates standard deviation.
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculates downside deviation (values below target/0).
 */
export function downsideDeviation(values: number[], target = 0): number {
  if (values.length < 2) return 0;
  const downsideDiffs = values.map((v) => Math.min(0, v - target));
  const variance = downsideDiffs.reduce((sum, v) => sum + Math.pow(v, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculates Covariance between two series.
 */
export function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - meanA) * (b[i] - meanB);
  }
  return cov / (n - 1);
}

/**
 * Computes the complete suite of Risk and Return metrics according to the notes.
 */
export function calculateRiskReturnMetrics(inputs: RiskReturnInputs): RiskReturnMetrics {
  const {
    portfolioReturns,
    benchmarkReturns,
    riskFreeRateAnnual = 0.045,
    inflationRateAnnual = 0.03,
    currencyDevaluationAnnual = 0.0,
  } = inputs;

  const n = portfolioReturns.length;
  if (n === 0) {
    return {
      dailyVolatilityPct: 0,
      annualizedVolatilityPct: 0,
      downsideVolatilityPct: 0,
      beta: 1,
      betaClassification: 'NEUTRAL',
      riskPremiumPct: 0,
      annualizedReturnPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      treynorRatio: 0,
      jensensAlphaPct: 0,
      paolucciRatio: 0,
      excessReturnOverBenchmarkPct: 0,
      realReturnNetPct: 0,
      isRealGainPositive: false,
    };
  }

  const tradingDays = 252;
  const dailyMeanPort = portfolioReturns.reduce((a, b) => a + b, 0) / n;
  const annualizedReturn = dailyMeanPort * tradingDays;

  const dailyVol = standardDeviation(portfolioReturns);
  const annualizedVol = dailyVol * Math.sqrt(tradingDays);
  const downsideVol = downsideDeviation(portfolioReturns, 0) * Math.sqrt(tradingDays);

  // Beta calculation
  const benchmarkVar = Math.pow(standardDeviation(benchmarkReturns), 2);
  const cov = covariance(portfolioReturns, benchmarkReturns);
  const beta = benchmarkVar > 0.000001 ? cov / benchmarkVar : 1.0;

  let betaClassification: 'DEFENSIVE' | 'NEUTRAL' | 'AGGRESSIVE' = 'NEUTRAL';
  if (beta < 0.9) betaClassification = 'DEFENSIVE';
  else if (beta > 1.1) betaClassification = 'AGGRESSIVE';

  const riskPremium = annualizedReturn - riskFreeRateAnnual;

  // Sharpe Ratio
  const sharpe = annualizedVol > 0 ? (annualizedReturn - riskFreeRateAnnual) / annualizedVol : 0;

  // Sortino Ratio
  const sortino = downsideVol > 0 ? (annualizedReturn - riskFreeRateAnnual) / downsideVol : 0;

  // Treynor Ratio
  const treynor = beta !== 0 ? (annualizedReturn - riskFreeRateAnnual) / beta : 0;

  // Jensen's Alpha
  const dailyMeanBench = benchmarkReturns.length > 0 ? benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length : 0;
  const annualizedBenchReturn = dailyMeanBench * tradingDays;
  const jensensAlpha = annualizedReturn - (riskFreeRateAnnual + beta * (annualizedBenchReturn - riskFreeRateAnnual));

  // Paolucci Ratio: (Excess return / Downside Volatility) adjusted for position direction
  const paolucci = downsideVol > 0 ? riskPremium / (downsideVol * (beta > 0 ? beta : 1)) : 0;

  // Excess return over benchmark
  const excessReturnOverBenchmark = annualizedReturn - annualizedBenchReturn;

  // Real Return Net (Notes: Retorno Esperado - Tasa Libre Riesgo - Benchmark - Tipo Cambio - Inflacion)
  const realReturnNet = annualizedReturn - riskFreeRateAnnual - inflationRateAnnual - currencyDevaluationAnnual;

  return {
    dailyVolatilityPct: Math.round(dailyVol * 10000) / 100,
    annualizedVolatilityPct: Math.round(annualizedVol * 10000) / 100,
    downsideVolatilityPct: Math.round(downsideVol * 10000) / 100,
    beta: Math.round(beta * 100) / 100,
    betaClassification,
    riskPremiumPct: Math.round(riskPremium * 10000) / 100,
    annualizedReturnPct: Math.round(annualizedReturn * 10000) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    sortinoRatio: Math.round(sortino * 100) / 100,
    treynorRatio: Math.round(treynor * 1000) / 1000,
    jensensAlphaPct: Math.round(jensensAlpha * 10000) / 100,
    paolucciRatio: Math.round(paolucci * 100) / 100,
    excessReturnOverBenchmarkPct: Math.round(excessReturnOverBenchmark * 10000) / 100,
    realReturnNetPct: Math.round(realReturnNet * 10000) / 100,
    isRealGainPositive: realReturnNet > 0,
  };
}
