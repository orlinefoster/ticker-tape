export interface MarketSignal {
  symbol: string;
  name: string;
  source: string;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number; // 0 to 100
  timeframe: string;
  rationale: string;
  suggestedEntry: number;
  suggestedStop: number;
  suggestedTarget: number;
  targetPortfolio: 'iol' | 'binance';
}

export interface WorkspaceShortcut {
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  accent: string;
}
