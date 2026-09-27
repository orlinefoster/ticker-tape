import React from 'react';
import { Card } from '@/components/ui';
import type { PortfolioCalculations } from '@/lib/usePortfolioCalculator';

interface AllocationCardProps {
  metrics: PortfolioCalculations;
}

export const AllocationCard: React.FC<AllocationCardProps> = ({ metrics }) => {
  return (
    <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          📊 Distribución de Capital &amp; Riesgo
        </h3>
        {metrics.totalNetWorthUsd > 0 && (
          <span
            className="font-mono"
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor:
                metrics.dryPowderStatus === 'OPTIMAL'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : metrics.dryPowderStatus === 'LOW_CASH'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
              color:
                metrics.dryPowderStatus === 'OPTIMAL'
                  ? 'var(--signal-bullish)'
                  : metrics.dryPowderStatus === 'LOW_CASH'
                  ? 'var(--signal-bearish)'
                  : 'var(--signal-warning)',
              fontWeight: 700,
            }}
          >
            {metrics.dryPowderStatus === 'OPTIMAL'
              ? 'Pólvora Seca: Equilibrada'
              : metrics.dryPowderStatus === 'LOW_CASH'
              ? 'Alerta: Baja Liquidez (<15%)'
              : 'Alta Liquidez (>60%)'}
          </span>
        )}
      </div>

      {metrics.totalNetWorthUsd === 0 ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🛡️</div>
          <div style={{ fontWeight: 700, color: 'var(--text-bright)' }}>Modo Real: Portafolio en $0.00 USD</div>
          <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            No se detectaron activos en custodia real. Sincronizá tus cuentas de Binance o broker IOL para visualizar la distribución de capital.
          </p>
        </div>
      ) : (
        <>
          {/* Allocation visual stacked bar */}
          <div
            style={{
              display: 'flex',
              height: '10px',
              width: '100%',
              borderRadius: '5px',
              overflow: 'hidden',
              backgroundColor: 'var(--border-subtle)',
            }}
            aria-hidden="true"
          >
            {metrics.allocationBreakdown.map((item) => (
              <div
                key={item.name}
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                  transition: 'width 0.3s ease',
                }}
                title={`${item.name}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Breakdown List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {metrics.allocationBreakdown.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      backgroundColor: item.color,
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="font-mono" style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                    ${item.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      width: '45px',
                      textAlign: 'right',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
