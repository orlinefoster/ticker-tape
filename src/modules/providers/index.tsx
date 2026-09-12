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
  const { status, pollStatus } = useServiceStatusStore();

  const [symbol, setSymbol] = useState('BTC');
  const [range, setRange] = useState('1y');
  const [targetProvider, setTargetProvider] = useState<string>('auto');
  const [forceRefresh, setForceRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pingResults, setPingResults] = useState<Record<string, PingResult | null>>({
    binance: null,
    yahoo: null,
    supabase: null,
    db: null,
  });
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [loadingCache, setLoadingCache] = useState(false);

  const [resultTab, setResultTab] = useState<'trace' | 'table' | 'json'>('trace');

  // Supabase Config State
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [savedSupaMsg, setSavedSupaMsg] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Quick Health Audit State
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditRows, setAuditRows] = useState<HealthTestRow[] | null>(null);

  const presetSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'SPY', 'AAPL', 'NVDA', 'TSLA', 'GGAL', 'AL30'];

  useEffect(() => {
    loadCacheOverview();
    const conf = getSupabaseConfig();
    setSupaUrl(conf.url);
    setSupaKey(conf.key);
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
    } catch (e: any) {
      setCloudSyncMsg(`❌ Error durante sincronización: ${e?.message || String(e)}`);
    } finally {
      setSyncingCloud(false);
    }
  };

  const handlePing = async (provider: 'binance' | 'yahoo' | 'supabase' | 'db') => {
    setPinging((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await commands.pingProviderTest(provider);
      setPingResults((prev) => ({ ...prev, [provider]: res }));
      pollStatus();
    } catch (e: any) {
      setPingResults((prev) => ({
        ...prev,
        [provider]: {
          provider,
          online: false,
          latency_ms: 0,
          endpoint: '',
          error: e?.message || String(e),
        },
      }));
    } finally {
      setPinging((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleTestFetch = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setTestResult(null);

    try {
      const result = await commands.testProviderFetch(symbol.trim(), range, forceRefresh, targetProvider);
      setTestResult(result);
      loadCacheOverview();
    } catch (err: any) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || 'Error desconocido al consultar el proveedor');
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
      } catch (e: any) {
        results.push({
          symbol: item.sym,
          provider: item.prov,
          bars: 0,
          latency: 0,
          status: 'error',
          httpStatus: e?.message || 'Error de Conexión',
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
      return {
        label: 'Supabase Cloud (PostgreSQL)',
        color: '#3ECF8E',
        bg: 'rgba(62, 207, 142, 0.12)',
        border: '#3ECF8E',
        icon: '☁️',
      };
    }
    if (p.includes('binance')) {
      return {
        label: 'Binance API (Crypto)',
        color: 'var(--accent-mint)',
        bg: 'rgba(0, 245, 212, 0.12)',
        border: 'var(--accent-mint)',
        icon: '⚡',
      };
    }
    if (p.includes('yahoo')) {
      return {
        label: 'Yahoo Finance (Equities / ETFs)',
        color: 'var(--accent-lavender)',
        bg: 'rgba(179, 136, 255, 0.12)',
        border: 'var(--accent-lavender)',
        icon: '📈',
      };
    }
    if (p.includes('iol') || p.includes('invertironline')) {
      return {
        label: 'IOL InvertirOnline (ARS / MEP / CEDEARs)',
        color: '#4CC9F0',
        bg: 'rgba(76, 201, 240, 0.12)',
        border: '#4CC9F0',
        icon: '🇦🇷',
      };
    }
    if (p.includes('cache') || p.includes('sqlite')) {
      return {
        label: 'SQLite Cache Local',
        color: 'var(--accent-sakura)',
        bg: 'rgba(255, 107, 157, 0.12)',
        border: 'var(--accent-sakura)',
        icon: '💾',
      };
    }
    return {
      label: providerName,
      color: 'var(--text-secondary)',
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'var(--border)',
      icon: '🌐',
    };
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

-- Habilitar acceso de lectura y escritura anónima (o ajustá RLS según tus políticas):
ALTER TABLE market_candles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON market_candles FOR SELECT USING (true);
CREATE POLICY "Allow public insert/upsert" ON market_candles FOR INSERT WITH CHECK (true);
`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              margin: '0 0 4px 0',
              background: 'linear-gradient(90deg, #FFFFFF 0%, var(--accent-sakura-soft) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
            }}
          >
            🔌 Diagnóstico & Sincronización Supabase Cloud
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Configurá la sincronización de caché entre SQLite local y Supabase Cloud para reutilizar velas históricas entre dispositivos y evitar llamadas repetidas a Binance.
          </p>
        </div>
        <Badge variant="sakura" pulse>
          SUPABASE SYNC READY
        </Badge>
      </div>

      {/* Provider Status Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Supabase Cloud Card */}
        <Card variant={pingResults.supabase?.online ? 'glow-mint' : 'default'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>☁️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Supabase Cloud
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Caché Compartida PostgreSQL</span>
              </div>
            </div>
            <Badge variant={pingResults.supabase?.online ? 'mint' : 'bearish'} pulse>
              {pingResults.supabase?.online ? 'CONNECTED' : 'DISCONNECTED'}
            </Badge>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', margin: '14px 0' }}>
            <div><strong>Endpoint:</strong> <code style={{ color: '#3ECF8E' }}>{supaUrl || 'No configurado'}</code></div>
            <div><strong>Tabla:</strong> <code className="font-mono">market_candles</code></div>
            {pingResults.supabase && (
              <div style={{ color: pingResults.supabase.online ? 'var(--signal-bullish)' : 'var(--signal-bearish)', fontWeight: 700 }}>
                Latencia: {pingResults.supabase.latency_ms} ms {pingResults.supabase.error && `(${pingResults.supabase.error})`}
              </div>
            )}
          </div>

          <Button
            variant="mint"
            size="sm"
            onClick={() => handlePing('supabase')}
            isLoading={pinging.supabase}
            style={{ width: '100%' }}
          >
            ☁️ Ping Supabase Cloud
          </Button>
        </Card>

        {/* Binance Card */}
        <Card variant={status.binance === 'connected' ? 'glow-mint' : 'default'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Binance Provider
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Criptomonedas (Spot Klines)</span>
              </div>
            </div>
            <Badge variant={status.binance === 'connected' ? 'mint' : 'bearish'} pulse>
              {status.binance === 'connected' ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', margin: '14px 0' }}>
            <div><strong>Endpoint:</strong> <code style={{ color: 'var(--accent-mint)' }}>api.binance.com/api/v3</code></div>
            <div><strong>Activos:</strong> BTC, ETH, SOL, BNB, Altcoins</div>
            {pingResults.binance && (
              <div style={{ color: pingResults.binance.online ? 'var(--signal-bullish)' : 'var(--signal-bearish)', fontWeight: 700 }}>
                Latencia: {pingResults.binance.latency_ms} ms {pingResults.binance.error && `(${pingResults.binance.error})`}
              </div>
            )}
          </div>

          <Button
            variant="mint"
            size="sm"
            onClick={() => handlePing('binance')}
            isLoading={pinging.binance}
            style={{ width: '100%' }}
          >
            ⚡ Test Ping Binance
          </Button>
        </Card>

        {/* Yahoo Card */}
        <Card variant={status.data === 'connected' ? 'glow-lavender' : 'default'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>📈</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Yahoo Finance
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Acciones & ETFs Tradicionales</span>
              </div>
            </div>
            <Badge variant={status.data === 'connected' ? 'lavender' : 'bearish'} pulse>
              {status.data === 'connected' ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', margin: '14px 0' }}>
            <div><strong>Endpoint:</strong> <code style={{ color: 'var(--accent-lavender)' }}>query2.finance.yahoo.com</code></div>
            <div><strong>Activos:</strong> SPY, QQQ, AAPL, NVDA, TSLA</div>
            {pingResults.yahoo && (
              <div style={{ color: pingResults.yahoo.online ? 'var(--signal-bullish)' : 'var(--signal-bearish)', fontWeight: 700 }}>
                Latencia: {pingResults.yahoo.latency_ms} ms {pingResults.yahoo.error && `(${pingResults.yahoo.error})`}
              </div>
            )}
          </div>

          <Button
            variant="lavender"
            size="sm"
            onClick={() => handlePing('yahoo')}
            isLoading={pinging.yahoo}
            style={{ width: '100%' }}
          >
            📈 Test Ping Yahoo
          </Button>
        </Card>

        {/* SQLite Local Cache Card */}
        <Card variant={status.db === 'connected' ? 'glow-sakura' : 'default'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>💾</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  SQLite Local Cache
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Persistencia Local WAL Mode</span>
              </div>
            </div>
            <Badge variant={status.db === 'connected' ? 'sakura' : 'bearish'} pulse>
              {status.db === 'connected' ? 'ACTIVE' : 'OFFLINE'}
            </Badge>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', margin: '14px 0' }}>
            <div><strong>Símbolos Cacheados:</strong> {cacheItems.length} activos</div>
            <div>
              <strong>Total Velas:</strong>{' '}
              <span className="font-mono">{cacheItems.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}</span>
            </div>
            {pingResults.db && (
              <div style={{ color: pingResults.db.online ? 'var(--signal-bullish)' : 'var(--signal-bearish)', fontWeight: 700 }}>
                Latencia DB: {pingResults.db.latency_ms} ms
              </div>
            )}
          </div>

          <Button
            variant="sakura"
            size="sm"
            onClick={() => handlePing('db')}
            isLoading={pinging.db}
            style={{ width: '100%' }}
          >
            💾 Test Ping DB
          </Button>
        </Card>
      </div>

      {/* Supabase Configuration Panel */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(62, 207, 142, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#3ECF8E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>☁️ Configuración de Conexión a Supabase Cloud</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Ingresá la URL y la Anon Public Key de tu proyecto Supabase para activar la sincronización en la nube.
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
            📋 {showSqlModal ? 'Ocultar Script SQL Table' : 'Ver Script SQL Table (market_candles)'}
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="mint" size="sm" onClick={handleSaveSupabaseConfig}>
              💾 Guardar Configuración Supabase
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

      {/* Main Request & Test Console */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              🧪 Consola de Peticiones & Auditoría de Enrutamiento
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Seleccioná el proveedor destino o probá la sincronización entre Supabase, Binance, Yahoo y SQLite local.
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
                  transition: 'all var(--transition-fast)',
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
              onClick={handleTestFetch}
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
          <div
            style={{
              marginTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Cards metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
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

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Último Cierre / Min - Max</div>
                <div className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-bright)', marginTop: '4px' }}>
                  ${testResult.last_close?.toLocaleString() || '0'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(${testResult.min_price?.toLocaleString()} - ${testResult.max_price?.toLocaleString()})</span>
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

            {/* Tab 1: Execution Trace Timeline */}
            {resultTab === 'trace' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  Diagnóstico de Ejecución por Pasos
                </h4>
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

            {/* Tab 2: Bars Sample Table */}
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
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(62, 207, 142, 0.03)',
                        }}
                      >
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

            {/* Tab 3: JSON Inspector */}
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

      {/* SQLite Cache Overview Table */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              💾 Explorador de Caché Local en SQLite
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Activos persistidos localmente para evitar llamadas repetidas a las APIs externas.
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadCacheOverview}
            disabled={loadingCache}
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            {loadingCache ? 'Cargando...' : '🔄 Refrescar Lista'}
          </Button>
        </div>

        {cacheItems.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No hay activos en caché todavía. Realizá un fetch arriba para almacenar datos.
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
                {cacheItems.map((item) => (
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
                          handleTestFetch();
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
  );
}
