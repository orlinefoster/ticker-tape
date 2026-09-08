import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// Check if running inside the native Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Safe invoke wrapper with browser fallback to prevent unhandled TypeErrors in dev browser
export const invoke = async <T = any>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }

  console.warn(`[Tauri IPC] Running outside native Tauri runtime. Command "${cmd}" intercepted in browser.`);

  switch (cmd) {
    case 'greet':
      return 'Hello from Browser Mock!' as unknown as T;
    case 'check_services_status':
      return { db: true, ai: false, data: true, binance: true } as unknown as T;
    case 'fetch_market_data':
      return [] as unknown as T;
    case 'run_strategy':
      return [] as unknown as T;
    case 'run_backtest':
      return {
        total_return: 0,
        annualized_return: 0,
        sharpe: 0,
        max_drawdown: 0,
        win_rate: 0,
        num_trades: 0,
        equity_curve: [],
      } as unknown as T;
    case 'run_analysis':
      return {} as unknown as T;
    case 'load_wave_labels':
      return [] as unknown as T;
    case 'save_wave_labels':
      return 0 as unknown as T;
    case 'recount_waves':
      return [] as unknown as T;
    case 'analyze_market_ai':
      return 'Modo navegador: conectate desde la app nativa de Tauri para interactuar con Ollama y el backend Rust.' as unknown as T;
    case 'query_ollama':
      return 'Modo navegador: Ollama está disponible en la app nativa de escritorio.' as unknown as T;
    case 'test_provider_fetch':
      return {
        symbol: (args?.symbol as string) || 'BTCUSDT',
        provider_used: 'browser-mock',
        cache_hit: false,
        bars_count: 0,
        latency_ms: 0,
        first_date: null,
        last_date: null,
        first_close: null,
        last_close: null,
        min_price: null,
        max_price: null,
        total_volume: 0,
        bars_sample: [],
      } as unknown as T;
    case 'ping_provider_test':
      return {
        provider: (args?.provider as string) || 'unknown',
        online: true,
        latency_ms: 45,
        endpoint: 'https://api.binance.com (web fallback)',
        error: null,
      } as unknown as T;
    case 'clear_symbol_cache':
      return 0 as unknown as T;
    case 'get_cache_stats':
      return [] as unknown as T;
    default:
      return null as unknown as T;
  }
};

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


