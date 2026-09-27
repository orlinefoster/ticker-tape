import React, { useEffect, useState } from 'react';
import { commands, type SymbolCacheSummary } from '@/lib/tauri';
import { useServiceStatusStore } from '@/store/serviceStatusStore';

interface DataIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataIntegrityModal: React.FC<DataIntegrityModalProps> = ({ isOpen, onClose }) => {
  const { override, status } = useServiceStatusStore();
  const [cacheList, setCacheList] = useState<SymbolCacheSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [resyncingSymbol, setResyncingSymbol] = useState<string | null>(null);
  const [purging, setPurging] = useState<boolean>(false);

  const loadCacheSummary = async () => {
    setLoading(true);
    try {
      const summary = await commands.getMarketDataSummary();
      setCacheList(summary || []);
    } catch (e) {
      setActionMessage({
        type: 'err',
        text: `Error al leer la base de datos local: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCacheSummary();
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalBars = cacheList.reduce((acc, item) => acc + (item.bar_count || 0), 0);

  const handlePurgeAll = async () => {
    if (!window.confirm('¿Confirmas purgar TODA la caché de datos de mercado en SQLite? Esto eliminará todos los registros históricos para garantizar cero datos sintéticos.')) {
      return;
    }
    setPurging(true);
    setActionMessage(null);
    try {
      const deleted = await commands.purgeMarketData([]);
      setActionMessage({
        type: 'ok',
        text: `Se purgaron exitosamente ${deleted} registros de la base de datos SQLite.`,
      });
      await loadCacheSummary();
    } catch (e) {
      setActionMessage({
        type: 'err',
        text: `Error al purgar la caché: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeSymbol = async (symbol: string) => {
    try {
      const deleted = await commands.purgeMarketData([symbol]);
      setActionMessage({
        type: 'ok',
        text: `Se eliminaron ${deleted} velas para ${symbol}.`,
      });
      await loadCacheSummary();
    } catch (e) {
      setActionMessage({
        type: 'err',
        text: `Error al purgar ${symbol}: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const handleResyncSymbol = async (symbol: string) => {
    setResyncingSymbol(symbol);
    setActionMessage(null);
    try {
      const res = await commands.resyncMarketData([symbol], '1y');
      if (res.synced.includes(symbol)) {
        setActionMessage({
          type: 'ok',
          text: `Sincronización exitosa para ${symbol} desde el proveedor oficial.`,
        });
      } else {
        const failReason = res.failed.find(([s]) => s === symbol)?.[1] || 'Fallo desconocido';
        setActionMessage({
          type: 'err',
          text: `No se pudo descargar ${symbol}: ${failReason}`,
        });
      }
      await loadCacheSummary();
    } catch (e) {
      setActionMessage({
        type: 'err',
        text: `Error al sincronizar ${symbol}: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setResyncingSymbol(null);
    }
  };

  const handleResyncAll = async () => {
    if (cacheList.length === 0) return;
    const symbols = cacheList.map((c) => c.symbol);
    setResyncingSymbol('__ALL__');
    setActionMessage(null);
    try {
      const res = await commands.resyncMarketData(symbols, '1y');
      const syncedCount = res.synced.length;
      const failedCount = res.failed.length;
      setActionMessage({
        type: failedCount === 0 ? 'ok' : 'err',
        text: `Sincronización completada: ${syncedCount} actualizados correctamente.${failedCount > 0 ? ` (${failedCount} fallaron)` : ''}`,
      });
      await loadCacheSummary();
    } catch (e) {
      setActionMessage({
        type: 'err',
        text: `Error en sincronización masiva: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setResyncingSymbol(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          fontFamily: 'monospace',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-bright)', letterSpacing: '0.04em' }}>
                INTEGRIDAD Y CONTROL DE DATOS (SQLITE)
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Aislamiento estricto entre Modo Real y Modo Simulación. Sin contaminación cruzada.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: override === 'Real' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Modo Activo:</span>
            <span
              style={{
                fontWeight: 700,
                color: override === 'Real' ? 'var(--signal-bullish)' : 'var(--signal-warning)',
              }}
            >
              {override === 'Real' ? '🟢 REAL (LIVE DATA)' : override === 'Mock' ? '🟡 SIMULACIÓN (PAPER DATA)' : '⚙️ AUTO'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Motor BD: {status.db === 'connected' ? 'SQLite WAL Activo' : 'Desconectado'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>
              Activos: <strong style={{ color: 'var(--text-bright)' }}>{cacheList.length}</strong>
            </span>
            <span>
              Velas Totales: <strong style={{ color: 'var(--text-bright)' }}>{totalBars.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Message banner */}
        {actionMessage && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: actionMessage.type === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid var(--border)',
              color: actionMessage.type === 'ok' ? 'var(--signal-bullish)' : 'var(--signal-bearish)',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            {actionMessage.type === 'ok' ? '✓ ' : '✕ '} {actionMessage.text}
          </div>
        )}

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Consultando catálogo de SQLite...
            </div>
          ) : cacheList.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>La base de datos SQLite no contiene velas en caché</div>
              <div style={{ fontSize: '0.75rem' }}>
                Cuando consultes símbolos en modo Real, se descargarán directamente de los proveedores oficiales (Yahoo / Binance).
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>SÍMBOLO</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>VELAS</th>
                  <th style={{ padding: '8px 10px' }}>DESDE</th>
                  <th style={{ padding: '8px 10px' }}>HASTA</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {cacheList.map((item) => (
                  <tr
                    key={item.symbol}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-bright)' }}>
                      {item.symbol}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {item.bar_count.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                      {item.min_date || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                      {item.max_date || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => handleResyncSymbol(item.symbol)}
                          disabled={resyncingSymbol === item.symbol}
                          title="Descargar datos frescos de la API y refrescar SQLite"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            backgroundColor: 'var(--bg-surface-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {resyncingSymbol === item.symbol ? '⏳' : '🔄 Resync'}
                        </button>
                        <button
                          onClick={() => handlePurgeSymbol(item.symbol)}
                          title="Eliminar este símbolo de la caché"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--signal-bearish)',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleResyncAll}
              disabled={cacheList.length === 0 || resyncingSymbol === '__ALL__'}
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: cacheList.length === 0 ? 'not-allowed' : 'pointer',
                opacity: cacheList.length === 0 ? 0.5 : 1,
              }}
            >
              {resyncingSymbol === '__ALL__' ? '⏳ Sincronizando todo...' : '🔄 Sincronizar Todo el Catálogo'}
            </button>

            <button
              onClick={handlePurgeAll}
              disabled={purging || cacheList.length === 0}
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--signal-bearish)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 'var(--radius-sm)',
                cursor: purging || cacheList.length === 0 ? 'not-allowed' : 'pointer',
                opacity: cacheList.length === 0 ? 0.5 : 1,
              }}
            >
              {purging ? '⏳ Purgando...' : '⚠️ Purgar Toda la Base'}
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
