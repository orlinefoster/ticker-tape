import { useState, useEffect } from 'react';
import { commands, ProviderTestResult, PingResult, CacheItem } from '@/lib/tauri';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { Card, Button, Badge } from '@/components/ui';

export default function ProvidersModule() {
  const { status, pollStatus } = useServiceStatusStore();

  const [symbol, setSymbol] = useState('BTC');
  const [range, setRange] = useState('1y');
  const [forceRefresh, setForceRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pingResults, setPingResults] = useState<Record<string, PingResult | null>>({
    binance: null,
    yahoo: null,
    db: null,
  });
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [loadingCache, setLoadingCache] = useState(false);

  const [resultTab, setResultTab] = useState<'table' | 'json'>('table');

  const presetSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'BTCUSDT', 'SPY', 'AAPL', 'NVDA', 'TSLA'];

  useEffect(() => {
    loadCacheOverview();
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

  const handlePing = async (provider: 'binance' | 'yahoo' | 'db') => {
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
      const result = await commands.testProviderFetch(symbol.trim(), range, forceRefresh);
      setTestResult(result);
      loadCacheOverview();
    } catch (err: any) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || 'Error desconocido al consultar el proveedor');
    } finally {
      setLoading(false);
    }
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
    switch (providerName.toLowerCase()) {
      case 'binance':
        return {
          label: 'Binance API (Crypto)',
          color: 'var(--accent-mint)',
          bg: 'rgba(0, 245, 212, 0.12)',
          border: 'var(--accent-mint)',
          icon: '⚡',
        };
      case 'yahoo-finance':
        return {
          label: 'Yahoo Finance (Equities / ETFs)',
          color: 'var(--accent-lavender)',
          bg: 'rgba(179, 136, 255, 0.12)',
          border: 'var(--accent-lavender)',
          icon: '📈',
        };
      case 'sqlite-cache':
        return {
          label: 'SQLite Cache Local',
          color: 'var(--accent-sakura)',
          bg: 'rgba(255, 107, 157, 0.12)',
          border: 'var(--accent-sakura)',
          icon: '💾',
        };
      default:
        return {
          label: providerName,
          color: 'var(--text-secondary)',
          bg: 'rgba(255, 255, 255, 0.08)',
          border: 'var(--border)',
          icon: '🌐',
        };
    }
  };

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
            🔌 Diagnóstico & Control de Proveedores
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Inspeccioná la latencia en tiempo real de Binance y Yahoo Finance, auditá la caché SQLite y probá peticiones nativas.
          </p>
        </div>
        <Badge variant="sakura" pulse>
          SYSTEM ONLINE
        </Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
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

        <Card variant={status.db === 'connected' ? 'glow-sakura' : 'default'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>💾</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  SQLite Local Cache
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Persistencia Local (WAL Mode)</span>
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

      <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              🧪 Consola de Peticiones y Prueba de Fetch
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Dispará una petición de prueba para inspeccionar qué proveedor responde, su latencia y el payload devuelto.
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Símbolo:</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTC, ETH, SPY..."
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
              <span>Forzar llamada remota (Bypass SQLite Cache)</span>
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
              onClick={() => handleClearCache(symbol)}
              title="Borrar velas de este activo en SQLite"
              style={{ color: 'var(--signal-bearish)', borderColor: 'var(--signal-bearish)' }}
            >
              🗑️ Limpiar Caché
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
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Rango Fechas</div>
                <div className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {testResult.first_date || 'N/A'} → {testResult.last_date || 'N/A'}
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Último Cierre / Min - Max</div>
                <div className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-bright)', marginTop: '4px' }}>
                  ${testResult.last_close?.toLocaleString() || '0'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(${testResult.min_price?.toLocaleString()} - ${testResult.max_price?.toLocaleString()})</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                  📋 Muestra de Velas (Primeras 5 y Últimas 5)
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
                {testResult.cache_hit ? '💾 Obtenido desde SQLite Cache local' : '🌐 Obtenido vía HTTP desde API remota y persistido en SQLite'}
              </span>
            </div>

            {resultTab === 'table' ? (
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
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 107, 157, 0.03)',
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
            ) : (
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
                  color: 'var(--accent-mint)',
                }}
              >
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>

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
