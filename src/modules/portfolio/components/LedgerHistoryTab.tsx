import React, { useState } from 'react';
import { Card, Badge } from '@/components/ui';
import type { UnifiedTransaction } from '@/store/portfolioStore';

interface LedgerHistoryTabProps {
  transactions: UnifiedTransaction[];
}

export const LedgerHistoryTab: React.FC<LedgerHistoryTabProps> = ({ transactions }) => {
  const [filterPortfolio, setFilterPortfolio] = useState<string>('ALL');

  const filtered = transactions.filter((tx) => {
    if (filterPortfolio !== 'ALL' && tx.portfolioType !== filterPortfolio) return false;
    return true;
  });

  return (
    <div
      role="tabpanel"
      id="tabpanel-history"
      aria-labelledby="tab-history"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
            Libro Contable Unificado de Transacciones
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Registro cronológico e inmutable de compras, ventas, depósitos y dividendos
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Filtrar Cartera:</label>
          <select
            value={filterPortfolio}
            onChange={(e) => setFilterPortfolio(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-bright)',
              fontSize: '0.75rem',
            }}
          >
            <option value="ALL">Todas las Carteras</option>
            <option value="cash">Solo Cash</option>
            <option value="iol">Solo IOL BYMA</option>
            <option value="binance">Solo Binance</option>
          </select>
        </div>
      </div>

      <Card style={{ padding: '0', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No se registran transacciones para el filtro seleccionado.
          </div>
        ) : (
          <table className="institutional-table" aria-label="Libro contable de transacciones">
            <thead>
              <tr>
                <th scope="col">FECHA / HORA</th>
                <th scope="col">CARTERA</th>
                <th scope="col">OPERACIÓN</th>
                <th scope="col">TICKER</th>
                <th scope="col" style={{ textAlign: 'right' }}>CANTIDAD</th>
                <th scope="col" style={{ textAlign: 'right' }}>PRECIO</th>
                <th scope="col" style={{ textAlign: 'right' }}>TOTAL NOMINAL</th>
                <th scope="col">DETALLE / NOTAS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge variant="neutral" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                      {tx.portfolioType}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge
                      variant={
                        tx.type === 'COMPRA' || tx.type === 'DEPOSITO' || tx.type === 'DIVIDENDO'
                          ? 'bullish'
                          : 'bearish'
                      }
                    >
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="font-mono" style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-bright)' }}>
                    {tx.symbol || '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {tx.quantity ? tx.quantity.toLocaleString() : '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {tx.price ? `$${tx.price.toLocaleString()}` : '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>
                    {tx.currency} ${tx.totalNominal.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {tx.notes || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};
