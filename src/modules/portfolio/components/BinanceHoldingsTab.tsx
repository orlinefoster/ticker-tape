import React, { useState } from 'react';
import { Card, Button } from '@/components/ui';
import type { BinanceHolding } from '@/store/portfolioStore';
import { parseBinanceCsv, reconcileBinanceRecords } from '@/lib/binanceImporter';

interface BinanceHoldingsTabProps {
  binanceHoldings: BinanceHolding[];
  onAddBinanceHolding: (holding: Omit<BinanceHolding, 'id'>) => void;
  onRemoveBinanceHolding: (id: string) => void;
  onAddTransaction: (tx: {
    portfolioType: 'binance';
    type: 'COMPRA' | 'VENTA';
    symbol: string;
    quantity: number;
    price: number;
    currency: 'USDT';
    totalNominal: number;
    notes: string;
  }) => void;
}

export const BinanceHoldingsTab: React.FC<BinanceHoldingsTabProps> = ({
  binanceHoldings,
  onAddBinanceHolding,
  onRemoveBinanceHolding,
  onAddTransaction,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

  // CSV Importer state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const buy = parseFloat(buyPrice);
    const curr = currentPrice ? parseFloat(currentPrice) : buy;
    if (!symbol || isNaN(numAmount) || isNaN(buy)) return;

    const symUpper = symbol.toUpperCase().trim();
    onAddBinanceHolding({
      symbol: symUpper,
      name: name || symUpper,
      amount: numAmount,
      avgBuyPriceUsdt: buy,
      currentPriceUsdt: curr,
    });

    onAddTransaction({
      portfolioType: 'binance',
      type: 'COMPRA',
      symbol: symUpper,
      quantity: numAmount,
      price: buy,
      currency: 'USDT',
      totalNominal: numAmount * buy,
      notes: `Compra manual Binance Spot ${symUpper}`,
    });

    setSymbol('');
    setName('');
    setAmount('');
    setBuyPrice('');
    setCurrentPrice('');
    setShowAddForm(false);
  };

  const handleImportCsv = () => {
    if (!csvText.trim()) return;
    try {
      const records = parseBinanceCsv(csvText);
      const reconciled = reconcileBinanceRecords(records, binanceHoldings);
      let count = 0;
      for (const holding of reconciled.updatedHoldings) {
        if (holding.amount > 0.000001) {
          onAddBinanceHolding(holding);
          count++;
        }
      }
      setCsvFeedback(`✅ Importación exitosa: ${count} activos spot incorporados al portafolio.`);
      setTimeout(() => {
        setShowCsvModal(false);
        setCsvFeedback(null);
        setCsvText('');
      }, 2500);
    } catch (err: unknown) {
      setCsvFeedback(err instanceof Error ? err.message : 'Error al procesar el archivo CSV de Binance');
    }
  };

  return (
    <div
      role="tabpanel"
      id="tabpanel-binance"
      aria-labelledby="tab-binance"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Header and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
            Cartera Crypto Spot (Binance)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Activos criptográficos en custodia Spot con cotizaciones expresadas en USDT
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="sm" variant="outline" onClick={() => setShowCsvModal(true)}>
            📥 Importar CSV Binance
          </Button>

          <Button size="sm" variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '✕ Cancelar' : '+ Agregar Activo'}
          </Button>
        </div>
      </div>

      {/* CSV Modal */}
      {showCsvModal && (
        <Card style={{ padding: '16px', border: '1px solid var(--accent-lavender)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-bright)' }}>
              Importador de Historial CSV de Binance
            </h4>
            <button
              onClick={() => setShowCsvModal(false)}
              aria-label="Cerrar modal"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Pega aquí el contenido de tu archivo CSV descargado de Binance (Trade History o Transaction Records):
          </p>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="UTC_Time,Account,Operation,Coin,Change,Remark..."
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-bright)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
          />

          {csvFeedback && (
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--signal-bullish)', fontWeight: 600 }}>
              {csvFeedback}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <Button size="sm" variant="ghost" onClick={() => setShowCsvModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="bullish" onClick={handleImportCsv} disabled={!csvText.trim()}>
              Procesar e Importar
            </Button>
          </div>
        </Card>
      )}

      {/* Manual Add Form */}
      {showAddForm && (
        <Card style={{ padding: '16px', border: '1px solid var(--accent)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Moneda / Ticker
              </label>
              <input
                type="text"
                placeholder="Ej: BTC, ETH, SOL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '120px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Nombre
              </label>
              <input
                type="text"
                placeholder="Ej: Bitcoin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: '6px 10px', minWidth: '160px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Balance
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '120px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Precio Compra (USDT)
              </label>
              <input
                type="number"
                step="any"
                placeholder="60000"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '130px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Precio Actual (USDT)
              </label>
              <input
                type="number"
                step="any"
                placeholder="65000"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                style={{ padding: '6px 10px', width: '130px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <Button type="submit" size="sm" variant="bullish">
              Guardar Activo
            </Button>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card style={{ padding: '0', overflow: 'hidden' }}>
        <table className="institutional-table" aria-label="Tabla de posiciones cripto spot">
          <thead>
            <tr>
              <th scope="col">ACTIVO</th>
              <th scope="col" style={{ textAlign: 'right' }}>BALANCE</th>
              <th scope="col" style={{ textAlign: 'right' }}>P. COMPRA (USDT)</th>
              <th scope="col" style={{ textAlign: 'right' }}>P. ACTUAL (USDT)</th>
              <th scope="col" style={{ textAlign: 'right' }}>VALUACIÓN USDT</th>
              <th scope="col" style={{ textAlign: 'right' }}>PNL %</th>
              <th scope="col" style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {binanceHoldings.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.6rem' }}>🪙</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      No hay posiciones Binance Spot registradas
                    </strong>
                    <span style={{ fontSize: '0.75rem', maxWidth: '440px', lineHeight: 1.4 }}>
                      En Modo Real, conecta tus claves en <strong>Proveedores &amp; Sincronización</strong>, importa un extracto CSV de Binance o agrega activos manualmente.
                    </span>
                  </div>
                </td>
              </tr>
            ) : binanceHoldings.map((b) => {
                const total = b.amount * b.currentPriceUsdt;
                const pnl = b.avgBuyPriceUsdt > 0 ? ((b.currentPriceUsdt - b.avgBuyPriceUsdt) / b.avgBuyPriceUsdt) * 100 : 0;
                const isProfit = pnl >= 0;

                return (
                <tr
                  key={b.id}
                  className={b.avgBuyPriceUsdt > 0 ? (isProfit ? 'row-bullish' : 'row-bearish') : undefined}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-bright)' }}>{b.symbol}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.name}</span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {b.amount.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    ${b.avgBuyPriceUsdt.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>
                    ${b.currentPriceUsdt.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--signal-bullish)', fontWeight: 700 }}>
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: isProfit ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                    {isProfit ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => onRemoveBinanceHolding(b.id)}
                      aria-label={`Eliminar activo ${b.symbol}`}
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
