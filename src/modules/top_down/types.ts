export type MarketUniverseType = 'crypto' | 'sectors' | 'megacap' | 'global' | 'cedears' | 'custom';

export interface UniversePreset {
  id: MarketUniverseType;
  label: string;
  description: string;
  benchmark: string;
  symbols: string[];
}

export type QuadrantType = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';

export interface RRGPoint {
  symbol: string;
  rsRatio: number;      // Normalizado alrededor de 100 (X)
  rsMomentum: number;   // Normalizado alrededor de 100 (Y)
  quadrant: QuadrantType;
  history: { x: number; y: number; date: string }[];
}

export interface RelativePerformanceItem {
  symbol: string;
  currentPrice: number;
  returns1w: number;
  returns1m: number;
  returns3m: number;
  returns6m: number;
  alpha1m: number;
  alpha3m: number;
  compositeScore: number;
  rrg: RRGPoint;
  isOutperformer: boolean;
  isMeanReversionCandidate: boolean;
}

export interface ElliottSetup {
  symbol: string;
  currentWave: string;       // e.g. "Wave 3", "Wave 4 (Dip)", "Wave C Bottom", "Wave 1 Breakout"
  degree: string;
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  invalidationPrice: number;
  targetPrice: number;
  suggestedAction: 'BUY_IMPULSE' | 'BUY_DIP' | 'ACCUMULATE_REVERSAL' | 'TAKE_PROFIT' | 'WAIT';
  rationale: string;
}

export interface IntermarketContext {
  regime: 'Risk-On' | 'Risk-Off' | 'Transitional' | 'Stagflationary';
  cyclePhase: 'EarlyExpansion' | 'LateExpansion' | 'Peak' | 'Contraction' | 'Trough';
  dollarTrend: 'Bullish' | 'Bearish' | 'Neutral';
  bondsTrend: 'Yields Falling (Bonds Up)' | 'Yields Rising (Bonds Down)' | 'Neutral';
  commoditiesTrend: 'Expansionary' | 'Deflationary' | 'Neutral';
  stocksBondsRatioTrend: 'Risk-Seeking' | 'Defensive';
  summaryText: string;
  confidence: number;
}

export interface AnalystCandidate {
  symbol: string;
  price: number;
  quadrant: QuadrantType;
  alpha3m: number;
  score: number;
  category: 'OUTPERFORMER' | 'MEAN_REVERSION' | 'NEUTRAL';
  elliott: ElliottSetup;
}

export interface AnalystReport {
  timestamp: string;
  universe: MarketUniverseType;
  benchmark: string;
  intermarket: IntermarketContext;
  items: RelativePerformanceItem[];
  topCandidates: AnalystCandidate[];
  summaryNarrative: string;
  compactAIPrompt: string;
  estimatedAITokens: number;
}

export type SizingMethod = 'fixed_risk' | 'atr_volatility' | 'half_kelly';

export interface OperatorSettings {
  totalCapital: number;
  riskPerTradePct: number;    // e.g. 1.0% = 0.01
  maxPortfolioHeatPct: number;// e.g. 6.0% = 0.06
  sizingMethod: SizingMethod;
  atrPeriod: number;
  defaultStopPct: number;     // e.g. 5% = 0.05 if no technical stop
}

export interface PlannedTrade {
  symbol: string;
  setupCategory: 'OUTPERFORMER' | 'MEAN_REVERSION' | 'NEUTRAL' | 'MANUAL';
  entryPrice: number;
  stopLossPrice: number;
  takeProfit1Price: number;
  takeProfit2Price: number;
  riskRewardRatio: number;
  positionShares: number;
  positionDollarValue: number;
  allocationPct: number;
  dollarRisk: number;
  riskPctOfCapital: number;
  rationale: string;
  quadrant: QuadrantType;
}

export interface EquityPoint {
  period: number;
  date: string;
  baselineEquity: number;
  projectedEquity: number;
  drawdownPct: number;
}

export interface OperatorPlan {
  settings: OperatorSettings;
  trades: PlannedTrade[];
  totalAllocatedDollar: number;
  totalAllocatedPct: number;
  totalPortfolioRiskDollar: number;
  totalPortfolioRiskPct: number;
  projectedSharpe: number;
  projectedSortino: number;
  maxEstimatedDrawdownPct: number;
  equityCurve: EquityPoint[];
}
