import { useState, useEffect } from 'react';
import {
  commands,
  ProviderTestResult,
  PingResult,
  CacheItem,
  getSupabaseConfig,
  saveSupabaseConfig,
  pushToSupabase,
} from '@/lib/tauri';
import {
  getBinanceConfig,
  saveBinanceConfig,
  clearBinanceConfig,
  testBinanceConnection,
  getIOLConfig,
  saveIOLConfig,
  clearIOLConfig,
  testIOLConnection,
} from '@/lib/providerConfigs';
import { iolMcpClient } from '@/lib/iolMcp';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { Card, Button, Badge } from '@/components/ui';

interface HealthTestRow {
  symbol: string;
  provider: string;
  bars: number;
  latency: number;
  status: 'ok' | 'error';
  httpStatus: string;
}

export default function ProvidersModule() {
  const { status, pollStatus, override } = useServiceStatusStore();

  // Navigation Sub-tab
  const [mainTab, setMainTab] = useState<'connections' | 'router' | 'database'>('connections');

  // --- Binance Config State ---
  const [binanceApiKey, setBinanceApiKey] = useState('');
  const [binanceSecretKey, setBinanceSecretKey] = useState('');
  const [binanceTestnet, setBinanceTestnet] = useState(false);
  const [binanceMsg, setBinanceMsg] = useState<string | null>(null);
  const [testingBinance, setTestingBinance] = useState(false);
  const [binanceTestResult, setBinanceTestResult] = useState<string | null>(null);
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);

  // --- IOL Config State ---
  const [iolEndpoint, setIolEndpoint] = useState('https://mcp.invertironline.com/');
  const [iolToken, setIolToken] = useState('');
  const [iolUsername, setIolUsername] = useState('');
  const [iolMsg, setIolMsg] = useState<string | null>(null);
  const [testingIol, setTestingIol] = useState(false);
  const [iolTestResult, setIolTestResult] = useState<{
    online: boolean;
    latencyMs?: number;
    message: string;
    tools: string[];
  } | null>(null);
  const [syncingIol, setSyncingIol] = useState(false);
  const [iolSyncMsg, setIolSyncMsg] = useState<string | null>(null);

  // --- Supabase Config State ---
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [savedSupaMsg, setSavedSupaMsg] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // --- General Pings & Health ---
  const [pingResults, setPingResults] = useState<Record<string, PingResult | null>>({
    binance: null,
    yahoo: null,
    supabase: null,
    db: null,
  });
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  // --- Test Router State ---
  const [symbol, setSymbol] = useState('BTC');
  const [range, setRange] = useState('1y');
  const [targetProvider, setTargetProvider] = useState<string>('auto');
  const [forceRefresh, setForceRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<'trace' | 'table' | 'json'>('trace');

  // --- Multi-provider Audit State ---
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditRows, setAuditRows] = useState<HealthTestRow[] | null>(null);

  // --- SQLite Cache & Batch Sync ---
  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheFilter, setCacheFilter] = useState('');
  const [batchSyncing, setBatchSyncing] = useState<string | null>(null);
  const [dbActionMsg, setDbActionMsg] = useState<string | null>(null);

  const presetSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'SPY', 'AAPL', 'NVDA', 'TSLA', 'GGAL', 'AL30'];

  useEffect(() => {
    loadCacheOverview();

    // Load Supabase
    const supaConf = getSupabaseConfig();
    setSupaUrl(supaConf.url);
    setSupaKey(supaConf.key);

    // Load Binance
    const binanceConf = getBinanceConfig();
    setBinanceApiKey(binanceConf.apiKey);
    setBinanceSecretKey(binanceConf.secretKey);
    setBinanceTestnet(binanceConf.isTestnet);

    // Load IOL
    const iolConf = getIOLConfig();
    setIolEndpoint(iolConf.endpoint);
    setIolToken(iolConf.token);
    setIolUsername(iolConf.username || '');
  }, []);

  const loadCacheOverview = async () => {
    setLoadingCache(true);
    try {
      const items = await commands.getCacheStats();
      setCacheItems(items);
    } catch (e) {
      console.error('Error loading cache stats:', e);
    } finally {
      setLoadingCache(false);
    }
  };

  // --- Supabase Handlers ---
  const handleSaveSupabaseConfig = () => {
    saveSupabaseConfig(supaUrl, supaKey);
    setSavedSupaMsg('Configuración de Supabase guardada correctamente.');
    setTimeout(() => setSavedSupaMsg(null), 3000);
    handlePing('supabase');
  };

  const handleSyncLocalToCloud = async () => {
    setSyncingCloud(true);
    setCloudSyncMsg(null);
    try {
      let totalSynced = 0;
      for (const item of cacheItems) {
        const bars = await commands.fetchMarketData(item.symbol, '5y');
        if (bars && bars.length > 0) {
          const ok = await pushToSupabase(bars);
          if (ok) totalSynced += bars.length;
        }
      }
      setCloudSyncMsg(`✅ Sincronización exitosa: ${totalSynced.toLocaleString()} velas subidas a Supabase Cloud.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCloudSyncMsg(`❌ Error durante sincronización: ${msg}`);
    } finally {
      setSyncingCloud(false);
    }
  };

  // --- Binance Handlers ---
  const handleSaveBinance = () => {
    saveBinanceConfig({
      apiKey: binanceApiKey,
      secretKey: binanceSecretKey,
      isTestnet: binanceTestnet,
    });
    setBinanceMsg('✅ Credenciales de Binance API guardadas localmente.');
    setTimeout(() => setBinanceMsg(null), 3500);
    handleTestBinance();
  };

  const handleClearBinance = () => {
    clearBinanceConfig();
    setBinanceApiKey('');
    setBinanceSecretKey('');
    setBinanceTestnet(false);
    setBinanceTestResult(null);
    setBinanceMsg('🗑️ Credenciales de Binance eliminadas.');
    setTimeout(() => setBinanceMsg(null), 3000);
  };

  const handleTestBinance = async () => {
    setTestingBinance(true);
    setBinanceTestResult(null);
    try {
      const res = await testBinanceConnection({
        apiKey: binanceApiKey,
        secretKey: binanceSecretKey,
        isTestnet: binanceTestnet,
      });
      setBinanceTestResult(res.message);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBinanceTestResult(`❌ Error de conexión: ${msg}`);
    } finally {
      setTestingBinance(false);
    }
  };

  // --- IOL MCP Handlers ---
  const handleSaveIOL = () => {
    saveIOLConfig({
      endpoint: iolEndpoint,
      token: iolToken,
      username: iolUsername,
    });
    setIolMsg('✅ Configuración de InvertirOnline (IOL MCP) guardada correctamente.');
    setTimeout(() => setIolMsg(null), 3500);
    handleTestIOL();
  };

  const handleClearIOL = () => {
    clearIOLConfig();
    setIolEndpoint('https://mcp.invertironline.com/');
    setIolToken('');
    setIolUsername('');
    setIolTestResult(null);
    setIolMsg('🗑️ Configuración de IOL restablecida.');
    setTimeout(() => setIolMsg(null), 3000);
  };

  const handleTestIOL = async () => {
    setTestingIol(true);
    setIolTestResult(null);
    try {
      const res = await testIOLConnection({
        endpoint: iolEndpoint,
        token: iolToken,
        username: iolUsername,
      });
      setIolTestResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setIolTestResult({
        online: false,
        latencyMs: 0,
        message: `❌ Error al conectar con IOL MCP: ${msg}`,
        tools: [],
      });
    } finally {
      setTestingIol(false);
    }
  };

  const handleSyncIOLPortfolio = async () => {
    setSyncingIol(true);
    setIolSyncMsg(null);
    try {
      const res = await iolMcpClient.syncPortfolio();
      usePortfolioStore.setState({
        iolHoldings: res.holdings,
      });
      setIolSyncMsg(`✅ Sincronizados con éxito ${res.holdings.length} activos de BYMA en Cartera IOL.`);
      setTimeout(() => setIolSyncMsg(null), 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setIolSyncMsg(`❌ Error al sincronizar con IOL: ${msg}`);
    } finally {
      setSyncingIol(false);
    }
  };

  // --- Batch Market Data Sync Handlers ---
  const handleBatchSync = async (
    type: 'macro' | 'crypto' | 'equities' | 'purge'
  ) => {
    setBatchSyncing(type);
    setDbActionMsg(null);
    try {
      if (type === 'macro') {
        const MACRO_SYMBOLS = [
          'SPY', 'TLT', 'DBC', 'GLD', 'HYG', 'BTC', 'XLF', 'XLE', 'XLK', 'QQQ',
          'AGG', 'UUP', 'LQD', 'CPER', 'TIP', 'SHY', 'IEF', 'XLI', 'XLV', 'XLP', 'XLY',
        ];
        const res = await commands.resyncMarketData(MACRO_SYMBOLS, '2y');
        setDbActionMsg(`✅ Canasta Macro: ${res.synced.length} activos sincronizados (2 años de velas).`);
      } else if (type === 'crypto') {
        const CRYPTO_SYMBOLS = [
          'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'NEAR', 'SUI', 'DOGE',
        ];
        const res = await commands.resyncMarketData(CRYPTO_SYMBOLS, '2y');
        setDbActionMsg(`✅ Cripto Universo: ${res.synced.length} activos sincronizados desde Binance Spot.`);
      } else if (type === 'equities') {
        const EQUITIES_SYMBOLS = [
          'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'IWM', 'DIA', 'VTI',
          'EEM', 'ARKK', 'SMH', 'GDX', 'SLV', 'USO',
        ];
        const res = await commands.resyncMarketData(EQUITIES_SYMBOLS, '2y');
        setDbActionMsg(`✅ Acciones Core: ${res.synced.length} activos sincronizados desde Yahoo Finance.`);
      } else if (type === 'purge') {
        if (!confirm('¿Estás seguro de purgar toda la base de datos SQLite? Deberás resincronizar los datos.')) {
          setBatchSyncing(null);
          return;
        }
        await commands.purgeMarketData([]);
        setDbActionMsg('🗑️ Base de datos SQLite purgada por completo.');
      }
      loadCacheOverview();
      setTimeout(() => setDbActionMsg(null), 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setDbActionMsg(`❌ Error en operación: ${msg}`);
    } finally {
      setBatchSyncing(null);
    }
  };

  // --- General Ping Handler ---
  const handlePing = async (provider: 'binance' | 'yahoo' | 'supabase' | 'db') => {
    setPinging((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await commands.pingProviderTest(provider);
      setPingResults((prev) => ({ ...prev, [provider]: res }));
      pollStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPingResults((prev) => ({
        ...prev,
        [provider]: {
          provider,
          online: false,
          latency_ms: 0,
          endpoint: '',
          error: msg,
        },
      }));
    } finally {
      setPinging((prev) => ({ ...prev, [provider]: false }));
    }
  };

  // --- Test Fetch Handler ---
  const handleTestFetch = async (
    overrideSymbol?: string,
    overrideRange?: string,
    overrideForce?: boolean,
    overrideTarget?: string
  ) => {
    const sym = (overrideSymbol ?? symbol).trim();
    if (!sym) return;
    const rng = overrideRange ?? range;
    const force = overrideForce ?? forceRefresh;
    const target = overrideTarget ?? targetProvider;

    setLoading(true);
    setErrorMessage(null);
    setTestResult(null);

    try {
      const result = await commands.testProviderFetch(sym, rng, force, target);
      setTestResult(result);
      loadCacheOverview();
    } catch (err: unknown) {
      setErrorMessage(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Error desconocido al consultar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const handleRunHealthAudit = async () => {
    setRunningAudit(true);
    setAuditRows([]);
    const testList = [
      { sym: 'BTCUSDT', prov: 'binance' },
      { sym: 'ETHUSDT', prov: 'binance' },
      { sym: 'SPY', prov: 'yahoo' },
      { sym: 'AAPL', prov: 'yahoo' },
      { sym: 'BTC', prov: 'supabase' },
      { sym: 'GGAL.BA', prov: 'iol' },
    ];

    const results: HealthTestRow[] = [];
    for (const item of testList) {
      try {
        const res = await commands.testProviderFetch(item.sym, '1m', true, item.prov);
        results.push({
          symbol: item.sym,
          provider: res.provider_used,
          bars: res.bars_count,
          latency: res.latency_ms,
          status: res.bars_count > 0 ? 'ok' : 'error',
          httpStatus: res.http_status || '200 OK',
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error de Conexión';
        results.push({
          symbol: item.sym,
          provider: item.prov,
          bars: 0,
          latency: 0,
          status: 'error',
          httpStatus: msg,
        });
      }
    }

    setAuditRows(results);
    setRunningAudit(false);
    loadCacheOverview();
  };

  const handleClearCache = async (targetSymbol: string) => {
    try {
      await commands.clearSymbolCache(targetSymbol);
      loadCacheOverview();
      if (testResult?.symbol === targetSymbol.toUpperCase()) {
        setTestResult(null);
      }
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  };

  const getProviderBadge = (providerName: string) => {
    const p = providerName.toLowerCase();
    if (p.includes('supabase')) {
      return { label: 'Supabase Cloud (PostgreSQL)', color: '#3ECF8E', bg: 'rgba(62, 207, 142, 0.12)', border: '#3ECF8E', icon: '☁️' };
    }
    if (p.includes('binance')) {
      return { label: 'Binance API (Crypto)', color: 'var(--accent-mint)', bg: 'rgba(0, 245, 212, 0.12)', border: 'var(--accent-mint)', icon: '⚡' };
    }
    if (p.includes('yahoo')) {
      return { label: 'Yahoo Finance (Equities / ETFs)', color: 'var(--accent-lavender)', bg: 'rgba(179, 136, 255, 0.12)', border: 'var(--accent-lavender)', icon: '📈' };
    }
    if (p.includes('iol') || p.includes('invertironline')) {
      return { label: 'IOL InvertirOnline (ARS / MEP / CEDEARs)', color: '#4CC9F0', bg: 'rgba(76, 201, 240, 0.12)', border: '#4CC9F0', icon: '🇦🇷' };
    }
    if (p.includes('cache') || p.includes('sqlite')) {
      return { label: 'SQLite Cache Local', color: 'var(--accent-sakura)', bg: 'rgba(255, 107, 157, 0.12)', border: 'var(--accent-sakura)', icon: '💾' };
    }
    return { label: providerName, color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.08)', border: 'var(--border)', icon: '🌐' };
  };

  const sqlSchemaSnippet = `-- Ejecutá este script en el SQL Editor de tu proyecto Supabase:

CREATE TABLE IF NOT EXISTS market_candles (
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, date)
);

-- Habilitar acceso de lectura y escritura:
ALTER TABLE market_candles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON market_candles FOR SELECT USING (true);
CREATE POLICY "Allow public insert/upsert" ON market_candles FOR INSERT WITH CHECK (true);
`;

  const filteredCacheItems = cacheItems.filter((i) =>
    i.symbol.toLowerCase().includes(cacheFilter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              margin: '0 0 4px 0',
              background: 'linear-gradient(90deg, #FFFFFF 0%, var(--accent-sakura-soft) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
            }}
          >
            🔌 Conectividad & Proveedores (APIs, Broker MCP & Cloud Sync)
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Configurá tus credenciales de broker y exchanges, administrá el servidor MCP de InvertirOnline y gestioná la persistencia de SQLite y Supabase Cloud.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant={override === 'Real' ? 'mint' : 'lavender'}>
            {override === 'Real' ? '🟢 MODO REAL (LIVE APIS)' : '⚠️ SIMULACIÓN (SANDBOX)'}
          </Badge>
          <Badge variant="sakura" pulse>
            MCP PROTOCOL READY
          </Badge>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <button
          onClick={() => setMainTab('connections')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: mainTab === 'connections' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
            color: mainTab === 'connections' ? '#0B0D17' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🎛️ Centro de Conexiones & Credenciales
        </button>

        <button
          onClick={() => setMainTab('router')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: mainTab === 'router' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
            color: mainTab === 'router' ? '#0B0D17' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🧪 Enrutador & Diagnóstico de Peticiones
        </button>

        <button
          onClick={() => setMainTab('database')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: mainTab === 'database' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
            color: mainTab === 'database' ? '#0B0D17' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          💾 Base SQLite & Gestión de Datos ({cacheItems.length})
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CENTRO DE CONEXIONES & CREDENCIALES
         ========================================================================= */}
      {mainTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Provider Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {/* Binance Card */}
            <Card variant={status.binance === 'connected' ? 'glow-mint' : 'default'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>⚡</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)' }}>Binance Spot</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Criptoactivos & Custodia</span>
                  </div>
                </div>
                <Badge variant={binanceApiKey ? 'mint' : 'warning'}>
                  {binanceApiKey ? 'VINCULADO' : 'SIN CLAVES'}
                </Badge>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {binanceTestnet ? 'Modo Testnet (Sandbox)' : 'Mainnet Oficial api.binance.com'}
              </div>
            </Card>

            {/* IOL MCP Card */}
            <Card variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>🇦🇷</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)' }}>InvertirOnline (IOL)</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Protocolo MCP / BYMA</span>
                  </div>
                </div>
                <Badge variant={iolToken ? 'mint' : 'lavender'}>
                  {iolToken ? 'AUTENTICADO' : 'MCP LISTO'}
                </Badge>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Endpoint: {iolEndpoint.replace('https://', '')}
              </div>
            </Card>

            {/* Supabase Cloud Card */}
            <Card variant={pingResults.supabase?.online ? 'glow-mint' : 'default'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>☁️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)' }}>Supabase Cloud</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Caché PostgreSQL Remota</span>
                  </div>
                </div>
                <Badge variant={supaUrl && supaKey ? 'mint' : 'neutral'}>
                  {supaUrl && supaKey ? 'CONFIGURADO' : 'SIN CONFIG'}
                </Badge>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Tabla sincronizada: <code className="font-mono">market_candles</code>
              </div>
            </Card>

            {/* SQLite Local Card */}
            <Card variant="glow-sakura">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>💾</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)' }}>SQLite Local WAL</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Almacén Local de Velas</span>
                  </div>
                </div>
                <Badge variant="sakura">
                  {cacheItems.length} ACTIVOS
                </Badge>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Total: {cacheItems.reduce((acc, c) => acc + c.count, 0).toLocaleString()} velas guardadas
              </div>
            </Card>
          </div>

          {/* 1. BINANCE API CREDENTIALS PANEL */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(0, 245, 212, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡ Conexión Binance API (Spot & Cuenta Real)</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Ingresá tus credenciales de API con permisos de lectura (o trading) para sincronizar tu saldo en tiempo real en Cartera Binance.
                </span>
              </div>
              <Badge variant={binanceApiKey ? 'mint' : 'warning'}>
                {binanceApiKey ? 'CLAVES GUARDADAS LOCALMENTE' : 'MODO SIN AUTENTICAR (PÚBLICO)'}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>BINANCE API KEY:</label>
                <input
                  type="text"
                  value={binanceApiKey}
                  onChange={(e) => setBinanceApiKey(e.target.value)}
                  placeholder="e.g. vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwC..."
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>BINANCE SECRET KEY:</label>
                  <button
                    type="button"
                    onClick={() => setShowBinanceSecret(!showBinanceSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-mint)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {showBinanceSecret ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  type={showBinanceSecret ? 'text' : 'password'}
                  value={binanceSecretKey}
                  onChange={(e) => setBinanceSecretKey(e.target.value)}
                  placeholder="e.g. 5x7f9u8w1e..."
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={binanceTestnet}
                  onChange={(e) => setBinanceTestnet(e.target.checked)}
                  style={{ accentColor: 'var(--accent-mint)' }}
                />
                <span>Usar Binance Testnet (Sandbox Spot testnet.binance.vision)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button variant="mint" size="sm" onClick={handleSaveBinance}>
                  💾 Guardar Credenciales Binance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestBinance}
                  isLoading={testingBinance}
                  disabled={testingBinance}
                >
                  ⚡ Probar Conexión & Verificar Latencia
                </Button>
                {binanceApiKey && (
                  <Button variant="ghost" size="sm" onClick={handleClearBinance} style={{ color: 'var(--signal-bearish)' }}>
                    🗑️ Desvincular Cuenta
                  </Button>
                )}
              </div>

              {binanceMsg && (
                <span style={{ fontSize: '0.78rem', color: 'var(--signal-bullish)', fontWeight: 600 }}>{binanceMsg}</span>
              )}
            </div>

            {binanceTestResult && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: binanceTestResult.startsWith('✅') || binanceTestResult.startsWith('⚡') ? 'rgba(0, 245, 212, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${binanceTestResult.startsWith('✅') || binanceTestResult.startsWith('⚡') ? 'var(--accent-mint)' : 'var(--signal-bearish)'}`,
                  fontSize: '0.78rem',
                  color: binanceTestResult.startsWith('✅') || binanceTestResult.startsWith('⚡') ? 'var(--accent-mint)' : 'var(--signal-bearish)',
                  fontWeight: 600,
                }}
              >
                {binanceTestResult}
              </div>
            )}
          </Card>

          {/* 2. INVERTIRONLINE (IOL) BROKER & MCP PANEL */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(76, 201, 240, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#4CC9F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🇦🇷 InvertirOnline (IOL Broker & Protocolo MCP)</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Integración oficial bajo el protocolo <strong>Model Context Protocol (MCP)</strong> para sincronizar portafolio BYMA, CEDEARs y saldos en pesos/dólar MEP.
                </span>
              </div>
              <Badge variant="mint">
                MCP TOOLS READY
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>MCP SERVER ENDPOINT:</label>
                <input
                  type="text"
                  value={iolEndpoint}
                  onChange={(e) => setIolEndpoint(e.target.value)}
                  placeholder="https://mcp.invertironline.com/"
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>IOL AUTH TOKEN (BEARER TOKEN / API):</label>
                <input
                  type="password"
                  value={iolToken}
                  onChange={(e) => setIolToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>USUARIO IOL (OPCIONAL):</label>
                <input
                  type="text"
                  value={iolUsername}
                  onChange={(e) => setIolUsername(e.target.value)}
                  placeholder="e.g. tu_email@dominio.com"
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button variant="mint" size="sm" onClick={handleSaveIOL}>
                  💾 Guardar Configuración IOL MCP
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestIOL}
                  isLoading={testingIol}
                  disabled={testingIol}
                  style={{ borderColor: '#4CC9F0', color: '#4CC9F0' }}
                >
                  🇦🇷 Test Handshake MCP & Herramientas
                </Button>
                <Button
                  variant="holo"
                  size="sm"
                  onClick={handleSyncIOLPortfolio}
                  isLoading={syncingIol}
                  disabled={syncingIol}
                >
                  🔄 Sincronizar Portafolio BYMA a Cartera IOL
                </Button>
                {iolToken && (
                  <Button variant="ghost" size="sm" onClick={handleClearIOL} style={{ color: 'var(--signal-bearish)' }}>
                    🗑️ Desvincular IOL
                  </Button>
                )}
              </div>

              {iolMsg && (
                <span style={{ fontSize: '0.78rem', color: 'var(--signal-bullish)', fontWeight: 600 }}>{iolMsg}</span>
              )}
            </div>

            {iolSyncMsg && (
              <div style={{ fontSize: '0.78rem', color: iolSyncMsg.startsWith('✅') ? '#4CC9F0' : 'var(--signal-bearish)', fontWeight: 700 }}>
                {iolSyncMsg}
              </div>
            )}

            {iolTestResult && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid rgba(76, 201, 240, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4CC9F0' }}>
                  {iolTestResult.message} ({iolTestResult.latencyMs} ms)
                </div>
                {iolTestResult.tools.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Herramientas MCP Expuestas:</span>
                    {iolTestResult.tools.map((t) => (
                      <span
                        key={t}
                        className="font-mono"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'rgba(76, 201, 240, 0.1)',
                          border: '1px solid rgba(76, 201, 240, 0.3)',
                          color: '#4CC9F0',
                          fontWeight: 700,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 3. SUPABASE CLOUD PANEL */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(62, 207, 142, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#3ECF8E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>☁️ Supabase Cloud (PostgreSQL Sincronizado)</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Almacená velas y snapshots de portafolio en la nube para compartirlos entre instancias del terminal y evitar peticiones repetidas.
                </span>
              </div>

              <button
                onClick={() => setShowSqlModal(!showSqlModal)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #3ECF8E',
                  backgroundColor: 'rgba(62, 207, 142, 0.1)',
                  color: '#3ECF8E',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📋 {showSqlModal ? 'Ocultar Script SQL' : 'Ver Script SQL Table (market_candles)'}
              </button>
            </div>

            {showSqlModal && (
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  padding: '12px',
                  backgroundColor: 'var(--bg-canvas)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 207, 142, 0.4)',
                  color: '#3ECF8E',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                }}
              >
                {sqlSchemaSnippet}
              </pre>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>SUPABASE PROJECT URL:</label>
                <input
                  type="text"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  placeholder="https://xyzxyz.supabase.co"
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>SUPABASE ANON KEY:</label>
                <input
                  type="password"
                  value={supaKey}
                  onChange={(e) => setSupaKey(e.target.value)}
                  placeholder="eyJhYmdj..."
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button variant="mint" size="sm" onClick={handleSaveSupabaseConfig}>
                  💾 Guardar Configuración Supabase
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePing('supabase')}
                  isLoading={pinging.supabase}
                  style={{ color: '#3ECF8E', borderColor: '#3ECF8E' }}
                >
                  ☁️ Ping Supabase Cloud
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncLocalToCloud}
                  isLoading={syncingCloud}
                  disabled={syncingCloud || cacheItems.length === 0}
                  style={{ color: '#3ECF8E', borderColor: '#3ECF8E' }}
                >
                  ☁️ Sincronizar Caché Local a Supabase Cloud
                </Button>
              </div>

              {savedSupaMsg && (
                <span style={{ fontSize: '0.78rem', color: 'var(--signal-bullish)', fontWeight: 600 }}>{savedSupaMsg}</span>
              )}
            </div>

            {cloudSyncMsg && (
              <div style={{ fontSize: '0.78rem', color: cloudSyncMsg.startsWith('✅') ? '#3ECF8E' : 'var(--signal-bearish)', fontWeight: 700 }}>
                {cloudSyncMsg}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ENRUTADOR & DIAGNÓSTICO DE PETICIONES
         ========================================================================= */}
      {mainTab === 'router' && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                🧪 Consola de Peticiones & Auditoría de Enrutamiento
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Probá el enrutamiento inteligente entre Supabase Cloud, Binance REST API, Yahoo Finance e InvertirOnline.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {presetSymbols.map((p) => (
                <button
                  key={p}
                  onClick={() => setSymbol(p)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: symbol === p ? '1px solid var(--accent-sakura)' : '1px solid var(--border-subtle)',
                    backgroundColor: symbol === p ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
                    color: symbol === p ? '#0B0D17' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Grid */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Símbolo Ticker:</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTC, SPY, GGAL..."
                className="font-mono"
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-bright)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  width: '140px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Proveedor Destino:</label>
              <select
                value={targetProvider}
                onChange={(e) => setTargetProvider(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="auto">🤖 Enrutamiento Automático (Smart Router)</option>
                <option value="supabase">☁️ Supabase Cloud (Base Sincronizada)</option>
                <option value="binance">⚡ Binance API (Criptomonedas)</option>
                <option value="yahoo">📈 Yahoo Finance (Acciones / ETFs)</option>
                <option value="iol">🇦🇷 IOL (InvertirOnline ARS / MEP)</option>
                <option value="cache">💾 Solo SQLite Cache Local</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rango Temporal:</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="1m">1 Mes (30 días)</option>
                <option value="3m">3 Meses (90 días)</option>
                <option value="1y">1 Año (365 días)</option>
                <option value="2y">2 Años</option>
                <option value="5y">5 Años</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-sakura)' }}
                />
                <span>Forzar llamada remota (Bypass Local Cache)</span>
              </label>
            </div>

            <div style={{ marginLeft: 'auto', paddingTop: '18px', display: 'flex', gap: '8px' }}>
              <Button
                variant="holo"
                size="md"
                onClick={() => handleTestFetch()}
                isLoading={loading}
                disabled={loading || !symbol.trim()}
              >
                🚀 Ejecutar Fetch de Prueba
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleRunHealthAudit}
                isLoading={runningAudit}
                disabled={runningAudit}
                title="Auditar estado de salud de todos los proveedores principales"
              >
                📊 Test Multiproveedor
              </Button>
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 51, 102, 0.12)',
                border: '1px solid var(--signal-bearish)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--signal-bearish)',
                fontSize: '0.85rem',
              }}
            >
              <strong>❌ Error en la respuesta del proveedor:</strong> {errorMessage}
            </div>
          )}

          {/* Quick Health Matrix Audit Results */}
          {auditRows && auditRows.length > 0 && (
            <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                📊 Resultado de Auditoría Rápida Multiproveedor
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Ticker</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Proveedor Utilizado</th>
                      <th style={{ textAlign: 'center', padding: '6px' }}>Velas</th>
                      <th style={{ textAlign: 'center', padding: '6px' }}>Latencia</th>
                      <th style={{ textAlign: 'right', padding: '6px' }}>HTTP Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((r, i) => {
                      const b = getProviderBadge(r.provider);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="font-mono" style={{ padding: '6px', fontWeight: 800, color: 'var(--text-bright)' }}>{r.symbol}</td>
                          <td style={{ padding: '6px' }}>
                            <span style={{ color: b.color, fontWeight: 700 }}>{b.icon} {b.label}</span>
                          </td>
                          <td className="font-mono" style={{ textAlign: 'center', padding: '6px' }}>{r.bars}</td>
                          <td className="font-mono" style={{ textAlign: 'center', padding: '6px', color: 'var(--accent-mint)' }}>{r.latency} ms</td>
                          <td className="font-mono" style={{ textAlign: 'right', padding: '6px', color: r.status === 'ok' ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                            {r.status === 'ok' ? '✅' : '❌'} {r.httpStatus}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Single Fetch Test Result */}
          {testResult && (
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Proveedor Utilizado</div>
                  <div style={{ marginTop: '4px' }}>
                    {(() => {
                      const b = getProviderBadge(testResult.provider_used);
                      return (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                            color: b.color,
                            backgroundColor: b.bg,
                            border: `1px solid ${b.border}`,
                            display: 'inline-block',
                          }}
                        >
                          {b.icon} {b.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Latencia Total</div>
                  <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-mint)', marginTop: '2px' }}>
                    ⚡ {testResult.latency_ms} ms
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Velas Recibidas</div>
                  <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '2px' }}>
                    📊 {testResult.bars_count.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>HTTP Status</div>
                  <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--signal-bullish)', marginTop: '4px' }}>
                    {testResult.http_status || '200 OK'}
                  </div>
                </div>
              </div>

              {testResult.endpoint_url && (
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Endpoint Consultado: </span>
                  <code className="font-mono" style={{ color: '#3ECF8E' }}>{testResult.endpoint_url}</code>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setResultTab('trace')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: resultTab === 'trace' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
                      color: resultTab === 'trace' ? '#0B0D17' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    🕵️ Traza de Pasos (Execution Log)
                  </button>

                  <button
                    onClick={() => setResultTab('table')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: resultTab === 'table' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
                      color: resultTab === 'table' ? '#0B0D17' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Muestra de Velas ({testResult.bars_sample.length})
                  </button>

                  <button
                    onClick={() => setResultTab('json')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: resultTab === 'json' ? 'var(--accent-sakura)' : 'var(--bg-canvas)',
                      color: resultTab === 'json' ? '#0B0D17' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    🔍 Inspector JSON Payload
                  </button>
                </div>

                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {testResult.cache_hit ? '💾 Obtenido desde Caché Sincronizada' : '🌐 Obtenido vía HTTP desde API remota'}
                </span>
              </div>

              {resultTab === 'trace' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  {testResult.execution_trace && testResult.execution_trace.length > 0 ? (
                    testResult.execution_trace.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${
                            step.status === 'ok' ? '#3ECF8E' : step.status === 'warn' ? '#FFD166' : 'var(--signal-bearish)'
                          }`,
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>
                          {step.status === 'ok' ? '✅' : step.status === 'warn' ? '⚠️' : '❌'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-bright)' }}>{step.step}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{step.detail}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No hay traza registrada.</div>
                  )}
                </div>
              )}

              {resultTab === 'table' && (
                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Fecha</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Apertura (Open)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Máximo (High)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Mínimo (Low)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Cierre (Close)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Volumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.bars_sample.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 600 }}>{b.date}</td>
                          <td className="font-mono" style={{ padding: '8px 12px' }}>${b.open.toFixed(2)}</td>
                          <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--signal-bullish)' }}>${b.high.toFixed(2)}</td>
                          <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--signal-bearish)' }}>${b.low.toFixed(2)}</td>
                          <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-bright)' }}>${b.close.toFixed(2)}</td>
                          <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{b.volume.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {resultTab === 'json' && (
                <pre
                  className="font-mono"
                  style={{
                    margin: 0,
                    padding: '16px',
                    backgroundColor: 'var(--bg-canvas)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    color: '#3ECF8E',
                  }}
                >
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          TAB 3: BASE SQLITE & GESTIÓN DE DATOS
         ========================================================================= */}
      {mainTab === 'database' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Batch Actions Card */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(255, 107, 157, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--accent-sakura)' }}>
                  📥 Descarga Masiva & Sincronización Automática
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Poblado masivo de velas históricas (2 años) directamente en SQLite local para alimentar todos los módulos de análisis.
                </span>
              </div>
              <Badge variant="sakura">
                26,000+ VELAS EN LOCAL
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => handleBatchSync('macro')}
                isLoading={batchSyncing === 'macro'}
                disabled={Boolean(batchSyncing)}
                style={{ borderColor: 'var(--accent-lavender)', color: 'var(--accent-lavender)' }}
              >
                🌐 Sincronizar Canasta Macro (21 ETFs)
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => handleBatchSync('crypto')}
                isLoading={batchSyncing === 'crypto'}
                disabled={Boolean(batchSyncing)}
                style={{ borderColor: 'var(--accent-mint)', color: 'var(--accent-mint)' }}
              >
                ⚡ Sincronizar Cripto Top (12 Tokens)
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => handleBatchSync('equities')}
                isLoading={batchSyncing === 'equities'}
                disabled={Boolean(batchSyncing)}
                style={{ borderColor: '#4CC9F0', color: '#4CC9F0' }}
              >
                📈 Sincronizar Acciones Core (16 Tickers)
              </Button>

              <Button
                variant="ghost"
                size="md"
                onClick={() => handleBatchSync('purge')}
                isLoading={batchSyncing === 'purge'}
                disabled={Boolean(batchSyncing)}
                style={{ color: 'var(--signal-bearish)', border: '1px solid var(--signal-bearish)' }}
              >
                🗑️ Purgar Toda la Base SQLite
              </Button>
            </div>

            {dbActionMsg && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: dbActionMsg.startsWith('✅') ? 'rgba(0, 245, 212, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${dbActionMsg.startsWith('✅') ? 'var(--accent-mint)' : 'var(--signal-bearish)'}`,
                  fontSize: '0.78rem',
                  color: dbActionMsg.startsWith('✅') ? 'var(--accent-mint)' : 'var(--signal-bearish)',
                  fontWeight: 600,
                }}
              >
                {dbActionMsg}
              </div>
            )}
          </Card>

          {/* SQLite Cache Overview Table */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                    💾 Explorador de Caché Local en SQLite
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {cacheItems.length} activos persistidos para alimentar los motores sin depender de internet.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={cacheFilter}
                  onChange={(e) => setCacheFilter(e.target.value)}
                  placeholder="Filtrar ticker..."
                  className="font-mono"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-bright)',
                    fontSize: '0.75rem',
                    outline: 'none',
                    width: '130px',
                  }}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadCacheOverview}
                  disabled={loadingCache}
                  style={{ border: '1px solid var(--border-subtle)' }}
                >
                  {loadingCache ? 'Cargando...' : '🔄 Refrescar'}
                </Button>
              </div>
            </div>

            {filteredCacheItems.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No se encontraron activos en caché. Usá los botones de sincronización masiva arriba.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Símbolo</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Cantidad de Velas</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Fecha Inicial</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Fecha Final</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCacheItems.map((item) => (
                      <tr key={item.symbol} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--accent-sakura)' }}>{item.symbol}</td>
                        <td className="font-mono" style={{ padding: '8px 12px' }}>{item.count.toLocaleString()}</td>
                        <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.min_date || 'N/A'}</td>
                        <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.max_date || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setSymbol(item.symbol);
                              setForceRefresh(false);
                              setTargetProvider('cache');
                              setMainTab('router');
                              handleTestFetch(item.symbol, undefined, false, 'cache');
                            }}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'var(--bg-canvas)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginRight: '6px',
                            }}
                          >
                            Inspeccionar
                          </button>
                          <button
                            onClick={() => handleClearCache(item.symbol)}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--signal-bearish)',
                              borderRadius: '4px',
                              color: 'var(--signal-bearish)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
