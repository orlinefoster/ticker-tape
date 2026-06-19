import { invoke } from '@tauri-apps/api/core';

// Types matching Rust structs (serde serialized across IPC)
export interface OHLCVBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  direction: 'Buy' | 'Sell' | 'Neutral';
  strength: number;
  timestamp: string;
  source: string;
}

export interface BacktestResult {
  total_return: number;
  annualized_return: number;
  sharpe: number;
  max_drawdown: number;
  win_rate: number;
  num_trades: number;
  equity_curve: number[];
}

// Typed command wrappers
export const commands = {
  greet: (name: string): Promise<string> => invoke('greet', { name }),

  fetchMarketData: (symbol: string, range: string): Promise<OHLCVBar[]> =>
    invoke('fetch_market_data', { symbol, range }),

  runStrategy: (symbol: string, strategy: string, params?: Record<string, unknown>): Promise<Signal[]> =>
    invoke('run_strategy', { symbol, strategy, params: params ?? {} }),

  runBacktest: (symbol: string, strategy: string, params?: Record<string, unknown>): Promise<BacktestResult> =>
    invoke('run_backtest', { symbol, strategy, params: params ?? {} }),
};
