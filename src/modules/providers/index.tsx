import { useState, useEffect } from 'react';
import { commands, ProviderTestResult, PingResult, CacheItem } from '@/lib/tauri';
import { useServiceStatusStore } from '@/store/serviceStatusStore';

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
          color: '#f3ba2f',
          bg: 'rgba(243, 186, 47, 0.15)',
          border: '#f3ba2f',
          icon: '⚡',
        };
      case 'yahoo-finance':
        return {
          label: 'Yahoo Finance (Equities / ETFs)',
          color: '#ab47bc',
          bg: 'rgba(171, 71, 188, 0.15)',
          border: '#ab47bc',
          icon: '📈',
        };
      case 'sqlite-cache':
        return {
          label: 'SQLite Cache Local',
          color: '#29b6f6',
          bg: 'rgba(41, 182, 246, 0.15)',
          border: '#29b6f6',
          icon: '💾',
        };
      default:
        return {
          label: providerName,
          color: '#888',
          bg: 'rgba(136, 136, 136, 0.15)',
          border: '#888',
          icon: '🌐',
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
          🔌 Diagnóstico & Control de Proveedores de Mercado
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Monitoreá el estado en tiempo real de los proveedores de datos, probá peticiones HTTP nativas y auditá la caché local.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>⚡</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Binance Provider
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Criptomonedas (Spot Klines)</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: status.binance === 'connected' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                color: status.binance === 'connected' ? '#4caf50' : '#f44336',
                border: `1px solid ${status.binance === 'connected' ? '#4caf50' : '#f44336'}`,
              }}
            >
              {status.binance === 'connected' ? 'ONLINE ✓' : 'OFFLINE ✗'}
            </span>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Endpoint:</strong> <code>api.binance.com/api/v3</code></div>
            <div><strong>Activos:</strong> BTC, ETH, SOL, BNB, Altcoins</div>
            {pingResults.binance && (
              <div style={{ color: pingResults.binance.online ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                Latencia: {pingResults.binance.latency_ms} ms {pingResults.binance.error && `(${pingResults.binance.error})`}
              </div>
            )}
          </div>

          <button
            onClick={() => handlePing('binance')}
            disabled={pinging.binance}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {pinging.binance ? 'Probando...' : '⚡ Test Ping Binance'}
          </button>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📈</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Yahoo Finance
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acciones & ETFs Tradicionales</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: status.data === 'connected' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                color: status.data === 'connected' ? '#4caf50' : '#f44336',
                border: `1px solid ${status.data === 'connected' ? '#4caf50' : '#f44336'}`,
              }}
            >
              {status.data === 'connected' ? 'ONLINE ✓' : 'OFFLINE ✗'}
            </span>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Endpoint:</strong> <code>query2.finance.yahoo.com</code></div>
            <div><strong>Activos:</strong> SPY, QQQ, AAPL, NVDA, TSLA</div>
            {pingResults.yahoo && (
              <div style={{ color: pingResults.yahoo.online ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                Latencia: {pingResults.yahoo.latency_ms} ms {pingResults.yahoo.error && `(${pingResults.yahoo.error})`}
              </div>
            )}
          </div>

          <button
            onClick={() => handlePing('yahoo')}
            disabled={pinging.yahoo}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {pinging.yahoo ? 'Probando...' : '📈 Test Ping Yahoo'}
          </button>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>💾</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  SQLite Local Cache
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Persistencia Local (WAL Mode)</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: status.db === 'connected' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                color: status.db === 'connected' ? '#4caf50' : '#f44336',
                border: `1px solid ${status.db === 'connected' ? '#4caf50' : '#f44336'}`,
              }}
            >
              {status.db === 'connected' ? 'ACTIVE ✓' : 'OFFLINE ✗'}
            </span>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Símbolos Cacheados:</strong> {cacheItems.length} activos</div>
            <div>
              <strong>Total Velas:</strong>{' '}
              {cacheItems.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
            </div>
            {pingResults.db && (
              <div style={{ color: pingResults.db.online ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                Latencia DB: {pingResults.db.latency_ms} ms
              </div>
            )}
          </div>

          <button
            onClick={() => handlePing('db')}
            disabled={pinging.db}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {pinging.db ? 'Probando...' : '💾 Test Ping DB'}
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              🧪 Consola de Peticiones y Prueba de Fetch
            </h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
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
                  borderRadius: '4px',
                  border: symbol === p ? '1px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: symbol === p ? 'var(--accent)' : 'var(--bg-primary)',
                  color: symbol === p ? '#fff' : 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Símbolo:</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTC, ETH, SPY..."
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 600,
                width: '140px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rango Temporal:</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Forzar llamada a API remota (Bypass SQLite Cache)</span>
            </label>
          </div>

          <div style={{ marginLeft: 'auto', paddingTop: '18px', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleTestFetch}
              disabled={loading || !symbol.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {loading ? 'Consultando Proveedor...' : '🚀 Ejecutar Fetch de Prueba'}
            </button>

            <button
              onClick={() => handleClearCache(symbol)}
              title="Borrar velas de este activo en SQLite"
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#f44336',
                border: '1px solid #f44336',
                borderRadius: 'var(--radius)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              🗑️ Limpiar Caché
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid #f44336',
              borderRadius: 'var(--radius)',
              color: '#f44336',
              fontSize: '0.875rem',
            }}
          >
            <strong>❌ Error en la respuesta del proveedor:</strong> {errorMessage}
          </div>
        )}

        {testResult && (
          <div
            style={{
              marginTop: '8px',
              borderTop: '1px solid var(--border)',
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
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Proveedor Utilizado</div>
                <div style={{ marginTop: '4px' }}>
                  {(() => {
                    const b = getProviderBadge(testResult.provider_used);
                    return (
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
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

              <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Latencia Total</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  ⚡ {testResult.latency_ms} ms
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Velas Recibidas</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  📊 {testResult.bars_count.toLocaleString()} velas
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Rango Fechas</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {testResult.first_date || 'N/A'} → {testResult.last_date || 'N/A'}
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Último Cierre / Min - Max</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  ${testResult.last_close?.toLocaleString() || '0'} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(${testResult.min_price?.toLocaleString()} - ${testResult.max_price?.toLocaleString()})</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setResultTab('table')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: resultTab === 'table' ? 'var(--accent)' : 'var(--bg-primary)',
                    color: resultTab === 'table' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  📋 Muestra de Velas (Primeras 5 y Últimas 5)
                </button>
                <button
                  onClick={() => setResultTab('json')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: resultTab === 'json' ? 'var(--accent)' : 'var(--bg-primary)',
                    color: resultTab === 'json' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  🔍 Inspector JSON Payload
                </button>
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {testResult.cache_hit ? '💾 Obtenido desde SQLite Cache local' : '🌐 Obtenido vía HTTP desde API remota y persistido en SQLite'}
              </span>
            </div>

            {resultTab === 'table' ? (
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px' }}>Fecha</th>
                      <th style={{ padding: '8px 12px' }}>Apertura (Open)</th>
                      <th style={{ padding: '8px 12px' }}>Máximo (High)</th>
                      <th style={{ padding: '8px 12px' }}>Mínimo (Low)</th>
                      <th style={{ padding: '8px 12px' }}>Cierre (Close)</th>
                      <th style={{ padding: '8px 12px' }}>Volumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.bars_sample.map((b, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{b.date}</td>
                        <td style={{ padding: '8px 12px' }}>${b.open.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#4caf50' }}>${b.high.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#f44336' }}>${b.low.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>${b.close.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{b.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  fontSize: '0.75rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  color: 'var(--text-primary)',
                }}
              >
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              💾 Explorador de Caché Local en SQLite
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Activos persistidos localmente para evitar llamadas repetidas a las APIs externas.
            </span>
          </div>

          <button
            onClick={loadCacheOverview}
            disabled={loadingCache}
            style={{
              padding: '4px 10px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loadingCache ? 'Cargando...' : '🔄 Refrescar Lista'}
          </button>
        </div>

        {cacheItems.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No hay activos en caché todavía. Realizá un fetch arriba para almacenar datos.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px' }}>Símbolo</th>
                  <th style={{ padding: '8px 12px' }}>Cantidad de Velas</th>
                  <th style={{ padding: '8px 12px' }}>Fecha Inicial</th>
                  <th style={{ padding: '8px 12px' }}>Fecha Final</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cacheItems.map((item) => (
                  <tr key={item.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{item.symbol}</td>
                    <td style={{ padding: '8px 12px' }}>{item.count.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.min_date || 'N/A'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.max_date || 'N/A'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSymbol(item.symbol);
                          setForceRefresh(false);
                          handleTestFetch();
                        }}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
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
                          border: '1px solid #f44336',
                          borderRadius: '4px',
                          color: '#f44336',
                          fontSize: '0.75rem',
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
      </div>
    </div>
  );
}
