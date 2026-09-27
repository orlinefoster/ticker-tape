import React from 'react';
import type { PortfolioCalculations } from '@/lib/usePortfolioCalculator';

interface DashboardKPIsProps {
  metrics: PortfolioCalculations;
  cclRate: number;
  onNavigate: (route: string) => void;
  isReal?: boolean;
}

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({ metrics, cclRate, onNavigate, isReal }) => {
  return (
    <section
      aria-label="Resumen de Patrimonio y Liquidez"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
        gap: '12px',
        padding: '14px 18px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* Net Worth */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: 'monospace',
          }}
        >
          Patrimonio Neto Consolidado
        </span>
        <div
          className="font-mono"
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--text-bright)',
            lineHeight: 1.1,
          }}
        >
          ${metrics.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>USD</span>
        </div>
        <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          ARS ${metrics.totalNetWorthArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}{' '}
          <span style={{ color: 'var(--text-muted)' }}>(CCL ${cclRate})</span>
        </div>
        {isReal && metrics.totalNetWorthUsd === 0 && (
          <div style={{ fontSize: '0.68rem', color: 'var(--signal-bearish)', fontWeight: 700, marginTop: '2px' }}>
            🔴 MODO REAL (CUENTAS SIN VINCULAR)
          </div>
        )}
      </div>

      {/* 1. Cash Portfolio Metric */}
      <div
        role="button"
        tabIndex={0}
        className="kpi-card-filled"
        onClick={() => onNavigate('/portfolio')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onNavigate('/portfolio');
        }}
        aria-label={`Liquidez en Cash: ${metrics.cashValuationUsd} dólares, ${metrics.cashAllocationPct.toFixed(1)}% del total`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            💵 Liquidez (Cash)
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              color: isReal && metrics.cashValuationUsd === 0 ? 'var(--text-muted)' : 'var(--signal-bullish)',
              fontWeight: 700,
            }}
          >
            {metrics.cashAllocationPct.toFixed(1)}%
          </span>
        </div>
        <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          ${metrics.cashValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isReal && metrics.cashValuationUsd === 0 ? '🔴 Sin saldo' : `Dry Powder: ${metrics.dryPowderStatus === 'OPTIMAL' ? '✅ Óptimo' : metrics.dryPowderStatus === 'LOW_CASH' ? '⚠️ Bajo' : '🛡️ Alto'}`}</span>
          {isReal && metrics.cashValuationUsd === 0 && <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>Configurar ➔</span>}
        </div>
      </div>

      {/* 2. IOL BYMA Portfolio Metric */}
      <div
        role="button"
        tabIndex={0}
        className="kpi-card-filled"
        onClick={() => onNavigate('/cartera-iol')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onNavigate('/cartera-iol');
        }}
        aria-label={`Cartera IOL BYMA: ${metrics.iolValuationUsd} dólares`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            🇦🇷 IOL (BYMA / CEDEARs)
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              color: isReal && metrics.iolValuationUsd === 0 ? 'var(--text-muted)' : 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {metrics.totalNetWorthUsd > 0 ? ((metrics.iolValuationUsd / metrics.totalNetWorthUsd) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
        <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          ${metrics.iolValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isReal && metrics.iolValuationUsd === 0 ? '🔴 Desconectado' : `ARS $${metrics.iolValuationArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}</span>
          {isReal && metrics.iolValuationUsd === 0 && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Conectar ➔</span>}
        </div>
      </div>

      {/* 3. Binance Crypto Portfolio Metric */}
      <div
        role="button"
        tabIndex={0}
        className="kpi-card-filled"
        onClick={() => onNavigate('/cartera')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onNavigate('/cartera');
        }}
        aria-label={`Cartera Crypto Binance: ${metrics.binanceValuationUsd} USDT`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            ⚡ Binance Spot (USDT)
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              color: isReal && metrics.binanceValuationUsd === 0 ? 'var(--text-muted)' : 'var(--accent-lavender)',
              fontWeight: 700,
            }}
          >
            {metrics.totalNetWorthUsd > 0 ? ((metrics.binanceValuationUsd / metrics.totalNetWorthUsd) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
        <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          ${metrics.binanceValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isReal && metrics.binanceValuationUsd === 0 ? '🔴 Desconectado' : 'Criptoactivos en custodia'}</span>
          {isReal && metrics.binanceValuationUsd === 0 && <span style={{ color: 'var(--accent-lavender)', fontWeight: 700 }}>Conectar ➔</span>}
        </div>
      </div>
    </section>
  );
};
