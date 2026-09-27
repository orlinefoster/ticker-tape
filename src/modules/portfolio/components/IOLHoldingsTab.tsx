import React, { useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import type { IOLHolding } from '@/store/portfolioStore';
import { iolMcpClient } from '@/lib/iolMcp';

interface IOLHoldingsTabProps {
  iolHoldings: IOLHolding[];
  cclRate: number;
  onAddIOLHolding: (holding: Omit<IOLHolding, 'id'>) => void;
  onRemoveIOLHolding: (id: string) => void;
  onAddTransaction: (tx: {
    portfolioType: 'iol';
    type: 'COMPRA' | 'VENTA';
    symbol: string;
    quantity: number;
    price: number;
    currency: 'ARS';
    totalNominal: number;
    notes: string;
  }) => void;
}

export const IOLHoldingsTab: React.FC<IOLHoldingsTabProps> = ({
  iolHoldings,
  cclRate,
  onAddIOLHolding,
  onRemoveIOLHolding,
  onAddTransaction,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<IOLHolding['assetType']>('CEDEAR');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

  // IOL MCP Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const buy = parseFloat(buyPrice);
    const curr = currentPrice ? parseFloat(currentPrice) : buy;
    if (!symbol || isNaN(qty) || isNaN(buy)) return;

    const symUpper = symbol.toUpperCase().trim();
    onAddIOLHolding({
      symbol: symUpper,
      name: name || symUpper,
      assetType,
      nominalQuantity: qty,
      avgBuyPriceArs: buy,
      currentPriceArs: curr,
      currencyExposure: assetType === 'ACCION_LOCAL' ? 'ARS' : 'USD_CCL',
    });

    onAddTransaction({
      portfolioType: 'iol',
      type: 'COMPRA',
      symbol: symUpper,
      quantity: qty,
      price: buy,
      currency: 'ARS',
      totalNominal: qty * buy,
      notes: `Compra manual IOL ${symUpper}`,
    });

    setSymbol('');
    setName('');
    setQuantity('');
    setBuyPrice('');
    setCurrentPrice('');
    setShowAddForm(false);
  };

  const handleSyncWithMcp = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const { holdings } = await iolMcpClient.syncPortfolio();
      for (const h of holdings) {
        onAddIOLHolding(h);
      }
      setSyncFeedback(`Sincronización IOL completada: ${holdings.length} activos detectados e incorporados.`);
    } catch (err: unknown) {
      setSyncFeedback(err instanceof Error ? err.message : 'Error al conectar con servidor IOL MCP');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  return (
    <div
      role="tabpanel"
      id="tabpanel-iol"
      aria-labelledby="tab-iol"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
            Portafolio InvertirOnline (BYMA)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            CEDEARs (Renta Variable USA en ARS), Bonos Soberanos, ONs Corporativas y Acciones Locales
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="outline"
            isLoading={isSyncing}
            onClick={handleSyncWithMcp}
            aria-label="Sincronizar portafolio con API de InvertirOnline"
          >
            🔄 Sincronizar MCP IOL
          </Button>

          <Button size="sm" variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '✕ Cancelar' : '+ Agregar Posición'}
          </Button>
        </div>
      </div>

      {syncFeedback && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {syncFeedback}
        </div>
      )}

      {/* Add Position Form */}
      {showAddForm && (
        <Card style={{ padding: '16px', border: '1px solid var(--accent)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Ticker / Símbolo
              </label>
              <input
                type="text"
                placeholder="Ej: SPY, AAPL, AL30"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '120px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Nombre / Descripción
              </label>
              <input
                type="text"
                placeholder="Ej: SPDR S&P 500 ETF"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: '6px 10px', minWidth: '180px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Tipo de Activo
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as IOLHolding['assetType'])}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)' }}
              >
                <option value="CEDEAR">CEDEAR</option>
                <option value="BONO_SOBERANO">Bono Soberano</option>
                <option value="ON_CORPORATIVA">Obligación Negociable (ON)</option>
                <option value="ACCION_LOCAL">Acción Argentina (BYMA)</option>
                <option value="FCI_CAUCION">FCI / Caución</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Cantidad
              </label>
              <input
                type="number"
                step="any"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '100px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Precio Compra (ARS)
              </label>
              <input
                type="number"
                step="any"
                placeholder="12500"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '130px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Precio Actual (ARS)
              </label>
              <input
                type="number"
                step="any"
                placeholder="13000"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                style={{ padding: '6px 10px', width: '130px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <Button type="submit" size="sm" variant="bullish">
              Guardar Posición
            </Button>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card style={{ padding: '0', overflow: 'hidden' }}>
        <table className="institutional-table" aria-label="Tabla de activos en InvertirOnline">
          <thead>
            <tr>
              <th scope="col">TICKER / ACTIVO</th>
              <th scope="col">TIPO</th>
              <th scope="col" style={{ textAlign: 'right' }}>CANTIDAD</th>
              <th scope="col" style={{ textAlign: 'right' }}>P. COMPRA</th>
              <th scope="col" style={{ textAlign: 'right' }}>P. ACTUAL</th>
              <th scope="col" style={{ textAlign: 'right' }}>TOTAL ARS</th>
              <th scope="col" style={{ textAlign: 'right' }}>VALUACIÓN USD (CCL)</th>
              <th scope="col" style={{ textAlign: 'right' }}>PNL %</th>
              <th scope="col" style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {iolHoldings.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.6rem' }}>🇦🇷</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      No hay posiciones BYMA / IOL registradas
                    </strong>
                    <span style={{ fontSize: '0.75rem', maxWidth: '440px', lineHeight: 1.4 }}>
                      En Modo Real, conecta el servidor MCP de InvertirOnline en <strong>Proveedores &amp; Sincronización</strong> para sincronizar tus activos, o agrégalos manualmente.
                    </span>
                  </div>
                </td>
              </tr>
            ) : iolHoldings.map((h) => {
                const totalArs = h.nominalQuantity * h.currentPriceArs;
                const usdVal = totalArs / cclRate;
                const pnlPct = h.avgBuyPriceArs > 0 ? ((h.currentPriceArs - h.avgBuyPriceArs) / h.avgBuyPriceArs) * 100 : 0;
                const isProfit = pnlPct >= 0;

                return (
                <tr
                  key={h.id}
                  className={h.avgBuyPriceArs > 0 ? (isProfit ? 'row-bullish' : 'row-bearish') : undefined}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-bright)' }}>{h.symbol}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Badge variant="neutral" style={{ fontSize: '0.68rem' }}>
                      {h.assetType}
                    </Badge>
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {h.nominalQuantity.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    ${h.avgBuyPriceArs.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>
                    ${h.currentPriceArs.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                    ${totalArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--signal-bullish)', fontWeight: 700 }}>
                    ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: isProfit ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                    {isProfit ? `+${pnlPct.toFixed(2)}%` : `${pnlPct.toFixed(2)}%`}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => onRemoveIOLHolding(h.id)}
                      aria-label={`Eliminar posición ${h.symbol}`}
                      style={{ background: 'transparent', border: 'none', color: 'var(--signal-bearish)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
