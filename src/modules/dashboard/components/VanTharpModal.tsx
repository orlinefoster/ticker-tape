import React, { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { calculatePositionSize } from '@/lib/vanTharp';
import type { MarketSignal } from '../types';

interface VanTharpModalProps {
  signal: MarketSignal;
  totalEquityUsd: number;
  onClose: () => void;
  onExecute: (result: {
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
  }) => void;
}

export const VanTharpModal: React.FC<VanTharpModalProps> = ({
  signal,
  totalEquityUsd,
  onClose,
  onExecute,
}) => {
  const [riskPct, setRiskPct] = useState<number>(1.0); // 1R = 1.0% equity
  const [entryPrice, setEntryPrice] = useState<number>(signal.suggestedEntry);
  const [stopPrice, setStopPrice] = useState<number>(signal.suggestedStop);
  const [targetPrice, setTargetPrice] = useState<number>(signal.suggestedTarget);

  const sizing = calculatePositionSize({
    totalEquity: totalEquityUsd,
    riskPercentage: riskPct,
    entryPrice,
    stopLossPrice: stopPrice,
    targetPrice,
    assetType: signal.targetPortfolio === 'binance' ? 'CRIPTO' : 'CEDEAR',
  });

  const handleConfirm = () => {
    if (!sizing || sizing.recommendedQuantity <= 0) return;
    onExecute({
      symbol: signal.symbol,
      name: signal.name,
      targetPortfolio: signal.targetPortfolio,
      quantity: sizing.recommendedQuantity,
      entryPrice,
      stopLossPrice: stopPrice,
      targetPrice,
      totalCapital: sizing.totalCapitalRequired,
      riskAmount: sizing.totalRiskAmount,
      rMultiple: sizing.rMultipleTarget || 0,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="van-tharp-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: '1px solid var(--accent)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 id="van-tharp-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              📐 Van Tharp Position Sizer: {signal.symbol}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Destino: {signal.targetPortfolio === 'binance' ? 'Binance Spot (USDT)' : 'InvertirOnline BYMA (ARS)'}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Riesgo por Trade (% Equity)
            </label>
            <input
              type="number"
              step="0.25"
              min="0.1"
              max="5.0"
              value={riskPct}
              onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0.1)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Precio de Entrada (Entry)
            </label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Stop Loss Inicial (1R)
            </label>
            <input
              type="number"
              step="any"
              value={stopPrice}
              onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Target Profit
            </label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Van Tharp Output Metrics */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CANTIDAD RECOMENDADA</div>
            <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--signal-bullish)' }}>
              {sizing.recommendedQuantity}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>unidades</div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>1R EN RIESGO ($)</div>
            <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--signal-bearish)' }}>
              ${sizing.totalRiskAmount.toFixed(0)}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{riskPct}% de la cuenta</div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PROYECCIÓN TARGET</div>
            <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>
              {sizing.rMultipleTarget ? `${sizing.rMultipleTarget.toFixed(1)}R` : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Relación Beneficio/Riesgo</div>
          </div>
        </div>

        {/* Capital Required Warning */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>Capital Total Requerido:</span>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>
            ${sizing.totalCapitalRequired.toLocaleString()} {signal.targetPortfolio === 'binance' ? 'USDT' : 'ARS'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={sizing.recommendedQuantity <= 0}
            onClick={handleConfirm}
          >
            ✅ Confirmar y Registrar Orden
          </Button>
        </div>
      </Card>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: 'var(--bg-canvas)',
  color: 'var(--text-bright)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  outline: 'none',
};
