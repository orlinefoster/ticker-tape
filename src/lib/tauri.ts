import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// Check if running inside the native Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

export interface ServicesStatus {
  db: boolean;
  ai: boolean;
  data: boolean;
  binance: boolean;
  supabase?: boolean;
}

export interface TraceStep {
  step: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

export interface ProviderTestResult {
  symbol: string;
  provider_used: 'binance' | 'yahoo-finance' | 'iol' | 'sqlite-cache' | 'supabase' | string;
  endpoint_url?: string | null;
  http_status?: string | null;
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
  execution_trace?: TraceStep[];
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

// Supabase Configuration Management
export function getSupabaseConfig(): { url: string; key: string } {
  const url = typeof window !== 'undefined'
    ? (localStorage.getItem('SUPABASE_URL') || (import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL || '')
    : '';
  const key = typeof window !== 'undefined'
    ? (localStorage.getItem('SUPABASE_ANON_KEY') || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '')
    : '';
  return { url: url.trim().replace(/\/$/, ''), key: key.trim() };
}

export function saveSupabaseConfig(url: string, key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('SUPABASE_URL', url.trim());
    localStorage.setItem('SUPABASE_ANON_KEY', key.trim());
  }
}

export async function pingSupabase(): Promise<PingResult> {
  const start = performance.now();
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return {
      provider: 'supabase',
      online: false,
      latency_ms: 0,
      endpoint: 'Supabase Cloud (No configurado)',
      error: 'Configurá la URL y Anon Key de Supabase arriba',
    };
  }

  try {
    const res = await fetch(`${url}/rest/v1/market_candles?select=count`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Range-Unit': 'items',
        'Range': '0-0',
      },
    });
    const latency = Math.round(performance.now() - start);
    return {
      provider: 'supabase',
      online: res.ok,
      latency_ms: latency,
      endpoint: `${url}/rest/v1/market_candles`,
      error: res.ok ? null : `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (e: any) {
    return {
      provider: 'supabase',
      online: false,
      latency_ms: Math.round(performance.now() - start),
      endpoint: url,
      error: e?.message || 'Error de conexión a Supabase',
    };
  }
}

export async function fetchFromSupabase(symbol: string): Promise<OHLCVBar[] | null> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  try {
    const upper = symbol.trim().toUpperCase();
    const res = await fetch(`${url}/rest/v1/market_candles?symbol=eq.${encodeURIComponent(upper)}&order=date.asc&limit=1000`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          symbol: item.symbol,
          date: item.date,
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
          volume: Number(item.volume),
        }));
      }
    }
  } catch (e) {
    console.warn('[Supabase Sync] Error leyendo de Supabase:', e);
  }
  return null;
}

export async function pushToSupabase(bars: OHLCVBar[]): Promise<boolean> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || bars.length === 0) return false;

  try {
    const payload = bars.map(b => ({
      symbol: b.symbol.toUpperCase(),
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));

    const res = await fetch(`${url}/rest/v1/market_candles`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (e) {
    console.warn('[Supabase Sync] Error escribiendo en Supabase:', e);
    return false;
  }
}

// In-Memory storage for Browser Dev Mode
const browserCacheMap = new Map<string, OHLCVBar[]>();

function getBasePriceForSymbol(sym: string): number {
  const s = sym.toUpperCase();
  if (s.includes('BTC')) return 65000;
  if (s.includes('ETH')) return 3500;
  if (s.includes('SOL')) return 145;
  if (s.includes('BNB')) return 580;
  if (s.includes('SPY')) return 550;
  if (s.includes('AAPL')) return 220;
  if (s.includes('NVDA')) return 125;
  if (s.includes('TSLA')) return 210;
  if (s.includes('QQQ')) return 480;
  if (s.includes('GGAL') || s.includes('AL30')) return 1500;
  return 100;
}

function generateSyntheticBars(symbol: string, days: number = 365): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  const basePrice = getBasePriceForSymbol(symbol);
  let currentPrice = basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    const changePercent = (Math.random() - 0.49) * 0.035;
    const open = currentPrice;
    const close = Math.max(1, open * (1 + changePercent));
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    const volume = Math.floor(Math.random() * 50000 + 10000);

    bars.push({
      symbol: symbol.toUpperCase(),
      date: dateStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }
  return bars;
}

async function fetchBrowserData(
  symbol: string,
  forceRefresh: boolean = false,
  targetProvider: string = 'auto'
): Promise<{
  bars: OHLCVBar[];
  provider: string;
  cacheHit: boolean;
  latency: number;
  endpointUrl: string;
  httpStatus: string;
  trace: TraceStep[];
}> {
  const upperSymbol = symbol.trim().toUpperCase();
  const startTime = performance.now();
  const trace: TraceStep[] = [];

  trace.push({
    step: '1. Normalización de Ticker',
    status: 'ok',
    detail: `Símbolo original: "${symbol}" ➔ Normalizado: "${upperSymbol}"`,
  });

  // Check local cache if allowed
  if (targetProvider === 'cache' || (!forceRefresh && targetProvider === 'auto' && browserCacheMap.has(upperSymbol))) {
    if (browserCacheMap.has(upperSymbol)) {
      const cached = browserCacheMap.get(upperSymbol)!;
      trace.push({
        step: '2. Chequeo de Caché (Browser Local)',
        status: 'ok',
        detail: `HIT Local: ${cached.length} velas encontradas en la memoria local.`,
      });
      return {
        bars: cached,
        provider: 'sqlite-cache (browser mock)',
        cacheHit: true,
        latency: Math.round(performance.now() - startTime),
        endpointUrl: 'memory://browser-storage',
        httpStatus: '200 OK (Local Cache HIT)',
        trace,
      };
    }
  }

  // Check Supabase Cloud Cache
  const { url: subUrl } = getSupabaseConfig();
  if (targetProvider === 'supabase' || (!forceRefresh && (targetProvider === 'auto' || targetProvider === 'supabase') && subUrl)) {
    trace.push({
      step: '2. Consulta a Supabase Cloud Cache',
      status: 'ok',
      detail: `Consultando tabla 'market_candles' en Supabase (${subUrl})...`,
    });

    const supaBars = await fetchFromSupabase(upperSymbol);
    if (supaBars && supaBars.length > 0) {
      browserCacheMap.set(upperSymbol, supaBars);
      const latency = Math.round(performance.now() - startTime);
      trace.push({
        step: '3. HIT Supabase Cloud',
        status: 'ok',
        detail: `¡ÉXITO! Se recuperaron ${supaBars.length} velas desde Supabase en ${latency}ms (Evitando llamadas repetidas a Binance/Yahoo).`,
      });

      return {
        bars: supaBars,
        provider: 'supabase',
        cacheHit: true,
        latency,
        endpointUrl: `${subUrl}/rest/v1/market_candles?symbol=eq.${upperSymbol}`,
        httpStatus: '200 OK (Supabase Cloud HIT)',
        trace,
      };
    } else {
      trace.push({
        step: '3. Supabase Cloud MISS',
        status: 'warn',
        detail: `No se encontraron registros para '${upperSymbol}' en Supabase Cloud. Procediendo a API remota...`,
      });
    }
  }

  trace.push({
    step: '3. Evaluador de Proveedores & Routing',
    status: 'ok',
    detail: `Proveedor solicitado: "${targetProvider}". Evaluando enrutamiento...`,
  });

  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'ADA', 'XRP'];
  const isCrypto = cryptoSymbols.some(c => upperSymbol.startsWith(c)) || upperSymbol.endsWith('USDT') || upperSymbol.endsWith('USD');
  const isIOL = upperSymbol.endsWith('.BA') || upperSymbol === 'AL30' || upperSymbol === 'GGAL';

  let pair = upperSymbol;
  if (!pair.endsWith('USDT') && !pair.endsWith('USD') && isCrypto) {
    pair = `${upperSymbol}USDT`;
  }

  const useBinance = targetProvider === 'binance' || (targetProvider === 'auto' && isCrypto);
  const useIOL = targetProvider === 'iol' || (targetProvider === 'auto' && isIOL);

  if (useBinance) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=365`;
    trace.push({
      step: '4. Petición HTTP a Binance REST API',
      status: 'ok',
      detail: `Disparando GET ${url}`,
    });

    try {
      const res = await fetch(url);
      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const rawData = await res.json();
        if (Array.isArray(rawData) && rawData.length > 0) {
          const bars: OHLCVBar[] = rawData.map((k: any) => {
            const date = new Date(k[0]).toISOString().split('T')[0];
            return {
              symbol: upperSymbol,
              date,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            };
          });

          browserCacheMap.set(upperSymbol, bars);
          trace.push({
            step: '5. Local Storage Persistido',
            status: 'ok',
            detail: `Éxito: ${bars.length} velas obtenidas de Binance. Almacenadas en memoria local.`,
          });

          // Async push to Supabase Cloud if configured
          pushToSupabase(bars).then(ok => {
            if (ok) console.log(`[Supabase Sync] Sincronizadas ${bars.length} velas de ${upperSymbol} en Supabase Cloud.`);
          });

          return {
            bars,
            provider: 'binance',
            cacheHit: false,
            latency,
            endpointUrl: url,
            httpStatus: '200 OK',
            trace,
          };
        }
      } else {
        trace.push({
          step: '5. Error HTTP Binance',
          status: 'error',
          detail: `HTTP Status: ${res.status} ${res.statusText}`,
        });
      }
    } catch (e: any) {
      trace.push({
        step: '5. Fallo Red / CORS Binance',
        status: 'warn',
        detail: `Petición a Binance fallida: ${e?.message || String(e)}. Usando generador sintético.`,
      });
    }
  }

  if (useIOL) {
    const url = `https://api.invertironline.com/api/v2/Cotizaciones/acciones/${upperSymbol}/pantalla/cotizacion`;
    trace.push({
      step: '4. Enrutador IOL (InvertirOnline)',
      status: 'ok',
      detail: `Conectando con servicio IOL (${url}) para ticker local "${upperSymbol}"...`,
    });
  }

  // Fallback Synthetic Generator
  const bars = generateSyntheticBars(upperSymbol, 365);
  browserCacheMap.set(upperSymbol, bars);
  const latency = Math.round(performance.now() - startTime);

  const fallbackProvider = useBinance
    ? 'binance (fallback sintético)'
    : useIOL
    ? 'iol (web mock)'
    : 'yahoo-finance (web mock)';

  const simulatedEndpoint = useBinance
    ? `https://api.binance.com/api/v3/klines?symbol=${pair}`
    : useIOL
    ? `https://api.invertironline.com/api/v2/Cotizaciones/${upperSymbol}`
    : `https://query2.finance.yahoo.com/v8/finance/chart/${upperSymbol}`;

  trace.push({
    step: '5. Generación Sintética de Velas (Browser Mode)',
    status: 'ok',
    detail: `Generadas ${bars.length} velas de prueba para "${upperSymbol}". (${fallbackProvider})`,
  });

  // Attempt background sync to Supabase if configured
  pushToSupabase(bars);

  return {
    bars,
    provider: fallbackProvider,
    cacheHit: false,
    latency,
    endpointUrl: simulatedEndpoint,
    httpStatus: '200 OK (Web Fallback)',
    trace,
  };
}

// Safe invoke wrapper with browser fallback to prevent unhandled TypeErrors in dev browser
export const invoke = async <T = any>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }

  console.warn(`[Tauri IPC] Running outside native Tauri runtime. Command "${cmd}" intercepted in browser.`);

  switch (cmd) {
    case 'greet':
      return 'Hello from Browser Mock!' as unknown as T;

    case 'check_services_status': {
      const supa = await pingSupabase();
      return { db: true, ai: false, data: true, binance: true, supabase: supa.online } as unknown as T;
    }

    case 'fetch_market_data': {
      const sym = (args?.symbol as string) || 'BTCUSDT';
      const { bars } = await fetchBrowserData(sym);
      return bars as unknown as T;
    }

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

    case 'test_provider_fetch': {
      const sym = (args?.symbol as string) || 'BTCUSDT';
      const force = Boolean(args?.forceRefresh || args?.force_refresh);
      const target = ((args?.targetProvider || args?.target_provider) as string) || 'auto';
      const { bars, provider, cacheHit, latency, endpointUrl, httpStatus, trace } = await fetchBrowserData(sym, force, target);

      const bars_count = bars.length;
      const first_date = bars[0]?.date || null;
      const last_date = bars[bars.length - 1]?.date || null;
      const first_close = bars[0]?.close || null;
      const last_close = bars[bars.length - 1]?.close || null;

      let min_price = bars.length ? bars[0].low : null;
      let max_price = bars.length ? bars[0].high : null;
      let total_volume = 0;

      for (const b of bars) {
        if (min_price === null || b.low < min_price) min_price = b.low;
        if (max_price === null || b.high > max_price) max_price = b.high;
        total_volume += b.volume;
      }

      const sample = bars.length > 10 ? [...bars.slice(0, 5), ...bars.slice(-5)] : bars;

      return {
        symbol: sym.toUpperCase(),
        provider_used: provider,
        endpoint_url: endpointUrl,
        http_status: httpStatus,
        cache_hit: cacheHit,
        bars_count,
        latency_ms: latency,
        first_date,
        last_date,
        first_close,
        last_close,
        min_price,
        max_price,
        total_volume,
        bars_sample: sample,
        execution_trace: trace,
      } as unknown as T;
    }

    case 'ping_provider_test': {
      const prov = (args?.provider as string) || 'unknown';
      const start = performance.now();
      if (prov === 'binance') {
        try {
          const res = await fetch('https://api.binance.com/api/v3/ping');
          const latency = Math.round(performance.now() - start);
          return {
            provider: 'binance',
            online: res.ok,
            latency_ms: latency,
            endpoint: 'https://api.binance.com/api/v3 (REST)',
            error: res.ok ? null : `HTTP ${res.status}`,
          } as unknown as T;
        } catch (e: any) {
          return {
            provider: 'binance',
            online: false,
            latency_ms: Math.round(performance.now() - start),
            endpoint: 'https://api.binance.com/api/v3',
            error: e?.message || 'Error de red en navegador',
          } as unknown as T;
        }
      } else if (prov === 'supabase') {
        return pingSupabase() as unknown as T;
      } else if (prov === 'yahoo') {
        return {
          provider: 'yahoo',
          online: true,
          latency_ms: 38,
          endpoint: 'https://query2.finance.yahoo.com (web fallback)',
          error: null,
        } as unknown as T;
      } else {
        return {
          provider: 'db',
          online: true,
          latency_ms: 2,
          endpoint: 'In-Memory Browser Storage',
          error: null,
        } as unknown as T;
      }
    }

    case 'clear_symbol_cache': {
      const sym = ((args?.symbol as string) || '').toUpperCase();
      if (!sym) {
        const size = browserCacheMap.size;
        browserCacheMap.clear();
        return size as unknown as T;
      }
      const existed = browserCacheMap.delete(sym);
      return (existed ? 1 : 0) as unknown as T;
    }

    case 'get_cache_stats': {
      const items: CacheItem[] = Array.from(browserCacheMap.entries()).map(([sym, bars]) => ({
        symbol: sym,
        count: bars.length,
        min_date: bars[0]?.date || null,
        max_date: bars[bars.length - 1]?.date || null,
      }));
      return items as unknown as T;
    }

    default:
      return null as unknown as T;
  }
};

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

  testProviderFetch: (
    symbol: string,
    range: string,
    forceRefresh: boolean = false,
    targetProvider: string = 'auto'
  ): Promise<ProviderTestResult> =>
    invoke('test_provider_fetch', { symbol, range, forceRefresh, targetProvider, force_refresh: forceRefresh, target_provider: targetProvider }),

  pingProviderTest: (provider: string): Promise<PingResult> =>
    invoke('ping_provider_test', { provider }),

  clearSymbolCache: (symbol: string): Promise<number> =>
    invoke('clear_symbol_cache', { symbol }),

  getCacheStats: (): Promise<CacheItem[]> =>
    invoke('get_cache_stats'),
};
