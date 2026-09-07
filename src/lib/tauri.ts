import { invoke } from '@tauri-apps/api/core';

// Re-export for direct use in modules
export { invoke };

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

  runAnalysis: (module: string, symbols: string[], parameters?: Record<string, unknown>): Promise<unknown> =>
    invoke('run_analysis', { module, symbols, parameters: parameters ?? {} }),

  loadWaveLabels: (symbol: string): Promise<unknown> =>
    invoke('load_wave_labels', { symbol }),

  saveWaveLabels: (labels: unknown[]): Promise<number> =>
    invoke('save_wave_labels', { labels }),

  recountWaves: (symbol: string): Promise<unknown> =>
    invoke('recount_waves', { symbol }),

  analyzeMarketAI: (symbol: string, model?: string): Promise<string> =>
    invoke('analyze_market_ai', { symbol, model }),

  queryOllama: (prompt: string, model?: string): Promise<string> =>
    invoke('query_ollama', { prompt, model }),

  checkServicesStatus: (): Promise<ServicesStatus> =>
    invoke('check_services_status'),

  testProviderFetch: (symbol: string, range: string, forceRefresh: boolean = false): Promise<ProviderTestResult> =>
    invoke('test_provider_fetch', { symbol, range, forceRefresh }),

  pingProviderTest: (provider: string): Promise<PingResult> =>
    invoke('ping_provider_test', { provider }),

  clearSymbolCache: (symbol: string): Promise<number> =>
    invoke('clear_symbol_cache', { symbol }),

  getCacheStats: (): Promise<CacheItem[]> =>
    invoke('get_cache_stats'),
};

export interface ServicesStatus {
  db: boolean;
  ai: boolean;
  data: boolean;
  binance: boolean;
}

export interface ProviderTestResult {
  symbol: string;
  provider_used: 'binance' | 'yahoo-finance' | 'sqlite-cache' | string;
  cache_hit: boolean;
  bars_count: number;
  latency_ms: number;
  first_date: string | null;
  last_date: string | null;
  first_close: number | null;
  last_close: number | null;
  min_price: number | null;
  max_price: number | null;
  total_volume: number;
  bars_sample: OHLCVBar[];
}

export interface PingResult {
  provider: string;
  online: boolean;
  latency_ms: number;
  endpoint: string;
  error: string | null;
}

export interface CacheItem {
  symbol: string;
  count: number;
  min_date: string | null;
  max_date: string | null;
}


