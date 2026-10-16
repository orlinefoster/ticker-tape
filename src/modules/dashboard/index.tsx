import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useUIStore } from '@/store/uiStore';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { usePortfolioCalculator } from '@/lib/usePortfolioCalculator';
import { DashboardKPIs } from './components/DashboardKPIs';
import { ActiveSignalsBoard } from './components/ActiveSignalsBoard';
import { AllocationCard } from './components/AllocationCard';
import { ModuleShortcuts } from './components/ModuleShortcuts';
import { VanTharpModal } from './components/VanTharpModal';
import type { MarketSignal } from './types';

const INITIAL_SIGNALS: MarketSignal[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF (CEDEAR)',
    source: 'Top-Down Macro',
    direction: 'BUY',
    score: 86,
    timeframe: 'Daily / 1W',
    rationale: 'Régimen de expansión macro y momentum sectorial favorable.',
    suggestedEntry: 560.0,
    suggestedStop: 535.0,
    suggestedTarget: 610.0,
    targetPortfolio: 'iol',
    currency: 'USD',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin Spot (Binance)',
    source: 'Alpha Rotation Radar',
    direction: 'BUY',
    score: 91,
    timeframe: 'Daily',
    rationale: 'Rotación de capital hacia activos de reserva con quiebre de rango.',
    suggestedEntry: 67250.0,
    suggestedStop: 63500.0,
    suggestedTarget: 75000.0,
    targetPortfolio: 'binance',
    currency: 'USD',
  },
  {
    symbol: 'GGAL',
    name: 'Grupo Fin. Galicia (BYMA)',
    source: 'Intermarket Cycle',
    direction: 'BUY',
    score: 78,
    timeframe: 'Daily',
    rationale: 'Baja del riesgo país y volumen comprador en sector financiero local.',
    suggestedEntry: 4750.0,
    suggestedStop: 4420.0,
    suggestedTarget: 5410.0,
    targetPortfolio: 'iol',
    currency: 'ARS',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc. (CEDEAR)',
    source: 'Topology Regimes',
    direction: 'NEUTRAL',
    score: 54,
    timeframe: 'Daily',
    rationale: 'Consolidación lateral en resistencia histórica.',
    suggestedEntry: 230.0,
    suggestedStop: 218.0,
    suggestedTarget: 254.0,
    targetPortfolio: 'iol',
    currency: 'USD',
  },
];

export function Dashboard() {
  const { override } = useServiceStatusStore();
  const { setActiveRoute } = useUIStore();
  const { rates, alerts, dismissAlert, addBinanceHolding, addIOLHolding, addTransaction } = usePortfolioStore();
  const metrics = usePortfolioCalculator();

  const [selectedSignal, setSelectedSignal] = useState<MarketSignal | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleExecuteSizedTrade = (order: {
    symbol: string;
    name: string;
    targetPortfolio: 'iol' | 'binance';
    quantity: number;
    entryPrice: number;
    stopLossPrice: number;
    targetPrice: number;
    totalCapital: number;
    riskAmount: number;
    rMultiple: number;
    currency: 'USD' | 'ARS';
  }) => {
    if (order.targetPortfolio === 'binance') {
      addBinanceHolding({
        symbol: order.symbol,
        name: order.name,
        amount: order.quantity,
        avgBuyPriceUsdt: order.entryPrice,
        currentPriceUsdt: order.entryPrice,
      });
      addTransaction({
        portfolioType: 'binance',
        type: 'COMPRA',
        symbol: order.symbol,
        quantity: order.quantity,
        price: order.entryPrice,
        currency: 'USDT',
        totalNominal: order.totalCapital,
        notes: `Orden Van Tharp: Stop en $${order.stopLossPrice}, Target en $${order.targetPrice} (${order.rMultiple.toFixed(1)}R)`,
      });
    } else {
      const ccl = rates.ccl || 1200;
      // If order is priced in USD (CEDEARs like SPY, AAPL), convert to ARS for IOL holding
      const isUsd = order.currency === 'USD';
      const priceArs = isUsd ? Math.round(order.entryPrice * ccl) : order.entryPrice;
      const totalArs = isUsd ? Math.round(order.totalCapital * ccl) : order.totalCapital;

      addIOLHolding({
        symbol: order.symbol,
        name: order.name,
        assetType: order.symbol === 'GGAL' ? 'ACCION_LOCAL' : 'CEDEAR',
        nominalQuantity: order.quantity,
        avgBuyPriceArs: priceArs,
        currentPriceArs: priceArs,
        currencyExposure: order.symbol === 'GGAL' ? 'ARS' : 'USD_CCL',
        cedearRatio: order.symbol === 'AAPL' ? '10:1' : '20:1',
      });
      addTransaction({
        portfolioType: 'iol',
        type: 'COMPRA',
        symbol: order.symbol,
        quantity: order.quantity,
        price: priceArs,
        currency: 'ARS',
        totalNominal: totalArs,
        notes: `Orden Van Tharp: Stop en $${order.stopLossPrice}, Target en $${order.targetPrice} (${order.rMultiple.toFixed(1)}R)`,
      });
    }

    setSuccessToast(`✅ Posición de ${order.quantity} ${order.symbol} registrada con éxito (Riesgo 1R = $${order.riskAmount.toFixed(0)} USD).`);
    setSelectedSignal(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Global Environment Status Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: override === 'Real' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${override === 'Real' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
          borderRadius: 'var(--radius)',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{override === 'Real' ? '🟢' : '⚠️'}</span>
          <span>
            <strong>{override === 'Real' ? 'MODO REAL ACTIVO:' : 'MODO SIMULACIÓN (PAPER TRADING):'}</strong>{' '}
            {override === 'Real'
              ? 'Cotizaciones y análisis 100% auténticos. Cartera real en $0.00 USD (cuentas no vinculadas).'
              : 'Entorno de simulación sandbox ($88,450 USD en activos virtuales). Órdenes reales deshabilitadas.'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {override === 'Real' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveRoute('/providers')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(0, 245, 212, 0.15)',
                  border: '1px solid var(--accent-mint)',
                  color: 'var(--accent-mint)',
                  cursor: 'pointer',
                }}
              >
                ⚡ Conectar Binance
              </button>
              <button
                onClick={() => setActiveRoute('/providers')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(76, 201, 240, 0.15)',
                  border: '1px solid #4CC9F0',
                  color: '#4CC9F0',
                  cursor: 'pointer',
                }}
              >
                🇦🇷 Conectar IOL
              </button>
            </div>
          )}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: override === 'Real' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: override === 'Real' ? 'var(--signal-bullish)' : 'var(--signal-warning)',
            }}
          >
            {override === 'Real' ? 'LIVE DATA ENGINE' : 'SANDBOX SIMULATOR'}
          </span>
        </div>
      </div>

      {/* 1. Consolidated Net Worth & Cash KPIs */}
      <DashboardKPIs
        metrics={metrics}
        cclRate={rates.ccl}
        onNavigate={setActiveRoute}
        isReal={override === 'Real'}
      />

      {/* 2. Success Toast */}
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--signal-bullish)',
            borderRadius: 'var(--radius)',
            color: 'var(--signal-bullish)',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          {successToast}
        </div>
      )}

      {/* 3. Operational Alerts Banner */}
      {alerts && alerts.length > 0 && (
        <div
          role="region"
          aria-label="Alertas Operativas"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {alerts.map((al) => (
            <div
              key={al.id}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor:
                  al.severity === 'critical'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : al.severity === 'warning'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                border: `1px solid ${
                  al.severity === 'critical'
                    ? 'var(--signal-bearish)'
                    : al.severity === 'warning'
                    ? 'var(--signal-warning)'
                    : 'var(--accent)'
                }`,
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true">{al.severity === 'critical' ? '🚨' : al.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{al.title}:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{al.detail}</span>
              </div>
              <button
                onClick={() => dismissAlert(al.id)}
                aria-label={`Descartar alerta ${al.id}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 4. Main Trading Grid: Signals & Allocation */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr', gap: '16px' }}>
        <ActiveSignalsBoard
          signals={INITIAL_SIGNALS}
          onSelectSignal={setSelectedSignal}
          onNavigate={setActiveRoute}
        />

        <AllocationCard metrics={metrics} />
      </div>

      {/* 5. Terminal Engine Shortcuts */}
      <ModuleShortcuts onNavigate={setActiveRoute} />

      {/* 6. Van Tharp Sizing Modal */}
      {selectedSignal && (
        <VanTharpModal
          signal={selectedSignal}
          totalEquityUsd={metrics.totalNetWorthUsd}
          cclRate={rates.ccl || 1200}
          onClose={() => setSelectedSignal(null)}
          onExecute={handleExecuteSizedTrade}
        />
      )}
    </div>
  );
}
