import React from 'react';
import { Card } from '@/components/ui';
import type { PortfolioCalculations } from '@/lib/usePortfolioCalculator';

interface ConsolidatedTabProps {
  metrics: PortfolioCalculations;
  cclRate: number;
}

export const ConsolidatedTab: React.FC<ConsolidatedTabProps> = ({ metrics, cclRate }) => {
  return (
    <div
      role="tabpanel"
      id="tabpanel-consolidated"
      aria-labelledby="tab-consolidated"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* 3 Major Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Card variant="filled" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            PATRIMONIO NETO GLOBAL
          </div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>
            ${metrics.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USD</span>
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            ARS ${metrics.totalNetWorthArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })} <span style={{ color: 'var(--text-muted)' }}>(CCL ${cclRate})</span>
          </div>
        </Card>

        <Card variant="filled" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            LIQUIDEZ / DRY POWDER
          </div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--signal-bullish)', marginTop: '4px' }}>
            {metrics.cashAllocationPct.toFixed(1)}%
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            ${metrics.cashValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD disponible
          </div>
        </Card>

        <Card variant="filled" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            CAPITAL INVERTIDO
          </div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>
            {metrics.investedAllocationPct.toFixed(1)}%
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            ${(metrics.totalNetWorthUsd - metrics.cashValuationUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD en riesgo
          </div>
        </Card>
      </div>

      {/* Asset Allocation Breakdown */}
      <Card style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          Estructura de Capital por Clases de Activo
        </h4>

        {metrics.totalNetWorthUsd === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>📊</span>
            <span>Sin capital activo registrado en Modo Real ($0.00 USD).</span>
            <span style={{ fontSize: '0.74rem' }}>
              Vincula tus cuentas en <strong>Proveedores &amp; Sincronización</strong> para consolidar y visualizar la distribución patrimonial.
            </span>
          </div>
        ) : (
          <>
            {/* Stacked Bar */}
            <div
              style={{
                display: 'flex',
                height: '14px',
                width: '100%',
                borderRadius: '6px',
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

            {/* Grid of Segments */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {metrics.allocationBreakdown.map((item) => (
                <div
                  key={item.name}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--border)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        backgroundColor: item.color,
                      }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.name}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
