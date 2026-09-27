import { useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import {
  calculateExoMetrics,
  computeExoTrajectory,
  type ExoMetricsResult,
} from '../services/exoScalingEngine';
import { calculatePositionVWAP } from '../services/vwapEngine';

interface ExoPositionManagerModalProps {
  symbol: string;
  initialEntryPrice: number;
  initialCurrentPrice: number;
  initialStopLoss?: number;
  initialTarget?: number;
  shares: number;
  onClose: () => void;
}

export function ExoPositionManagerModal({
  symbol,
  initialEntryPrice,
  initialCurrentPrice,
  initialStopLoss,
  initialTarget,
  shares,
  onClose,
}: ExoPositionManagerModalProps) {
  // Default stop 5% below entry, default target 15% above entry (initial B/R = 3.0)
  const defaultStop = initialStopLoss ?? Math.round(initialEntryPrice * 0.95 * 100) / 100;
  const defaultTarget = initialTarget ?? Math.round(initialEntryPrice * 1.15 * 100) / 100;

  const [entryPrice, setEntryPrice] = useState<number>(initialEntryPrice);
  const [stopLossPrice, setStopLossPrice] = useState<number>(defaultStop);
  const [targetPrice, setTargetPrice] = useState<number>(defaultTarget);
  const [simulatedPrice, setSimulatedPrice] = useState<number>(initialCurrentPrice);
  const [activeTab, setActiveTab] = useState<'exo' | 'trajectory' | 'vwap'>('exo');

  // Multi-entry UTs for VWAP
  const [entries] = useState([
    { amount: shares * 0.5, price: entryPrice * 0.98 },
    { amount: shares * 0.5, price: entryPrice * 1.02 },
  ]);

  const exoMetrics: ExoMetricsResult = calculateExoMetrics({
    symbol,
    entryPrice,
    stopLossPrice,
    targetPrice,
    currentPrice: simulatedPrice,
    shares,
  });

  const vwapResult = calculatePositionVWAP(
    entries,
    simulatedPrice,
    simulatedPrice * 0.99
  );

  // Trajectory simulation
  const trajectorySteps = 10;
  const priceHistory = [];
  const minP = stopLossPrice;
  const maxP = targetPrice;
  const step = (maxP - minP) / trajectorySteps;

  for (let i = 0; i <= trajectorySteps; i++) {
    const p = minP + step * i;
    priceHistory.push({
      date: `T+${i}`,
      close: Math.round(p * 100) / 100,
    });
  }

  const trajectory = computeExoTrajectory(entryPrice, stopLossPrice, targetPrice, priceHistory);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0F121C',
          borderRadius: '12px',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 229, 255, 0.15)',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📐</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                Gestión de Posición EXO: {symbol}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Modelo dinámico de Beneficio/Riesgo Ajustado para Des/Escalamiento y Ponderación de UTs.
              </span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
          <Button
            size="sm"
            variant={activeTab === 'exo' ? 'holo' : 'ghost'}
            onClick={() => setActiveTab('exo')}
          >
            ⚖️ B/R Ajustado &amp; Desescalamiento
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'trajectory' ? 'holo' : 'ghost'}
            onClick={() => setActiveTab('trajectory')}
          >
            📊 Matriz de Simulación (Excel EXO)
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'vwap' ? 'holo' : 'ghost'}
            onClick={() => setActiveTab('vwap')}
          >
            ⚓ VWAP de Posición (UTs)
          </Button>
        </div>

        {/* Parameter Inputs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Precio de Entrada ($):
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: '#151926',
                color: 'var(--text-bright)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--signal-bearish)', fontWeight: 700 }}>
              Stop Loss ($):
            </label>
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 51, 102, 0.3)',
                background: '#151926',
                color: 'var(--signal-bearish)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--signal-bullish)', fontWeight: 700 }}>
              Take Profit Target ($):
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                background: '#151926',
                color: 'var(--signal-bullish)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: '#00E5FF', fontWeight: 700 }}>
              Precio Simulado / Actual ($):
            </label>
            <input
              type="number"
              value={simulatedPrice}
              onChange={(e) => setSimulatedPrice(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 229, 255, 0.5)',
                background: '#151926',
                color: '#00E5FF',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* TAB 1: EXO B/R ADJUSTED */}
        {activeTab === 'exo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Recommendation banner */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderLeft: `4px solid ${exoMetrics.recommendationColor}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Diagnóstico EXO del Trade
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: exoMetrics.recommendationColor, marginTop: '2px' }}>
                  {exoMetrics.recommendationLabel}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {exoMetrics.suggestedActionText}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>B/R Ajustado</div>
                <div
                  className="font-mono"
                  style={{ fontSize: '1.7rem', fontWeight: 900, color: exoMetrics.recommendationColor }}
                >
                  {exoMetrics.adjustedBR.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Inicial: {exoMetrics.initialBR.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Retorno No Realizado</div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: exoMetrics.unrealizedReturnTotal >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)',
                  }}
                >
                  {exoMetrics.unrealizedReturnTotal >= 0 ? '+' : ''}${exoMetrics.unrealizedReturnTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  ${exoMetrics.unrealizedReturnPerUnit.toFixed(2)} / unidad
                </div>
              </Card>

              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Máx. Capital Arriesgado</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--signal-bearish)' }}>
                  ${exoMetrics.maxCapitalArriesgadoTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Stop + Ganancia flotante
                </div>
              </Card>

              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Ganancia Esperada Restante</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00E5FF' }}>
                  ${exoMetrics.gananciaEsperadaTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Distancia a TP
                </div>
              </Card>

              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Avance al Objetivo</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  {exoMetrics.progressToTargetPct.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Progreso en el tramo
                </div>
              </Card>
            </div>

            {/* Visual Gauge Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>Entrada: ${entryPrice}</span>
                <span>Precio actual: ${simulatedPrice}</span>
                <span>Objetivo: ${targetPrice}</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${exoMetrics.progressToTargetPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #FF6B9D, #00F5D4)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Trajectory Table */}
        {activeTab === 'trajectory' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px' }}>Etapa</th>
                  <th style={{ padding: '8px' }}>Precio</th>
                  <th style={{ padding: '8px' }}>Retorno Flotante</th>
                  <th style={{ padding: '8px' }}>Máx Riesgo</th>
                  <th style={{ padding: '8px' }}>Ganancia Esperada</th>
                  <th style={{ padding: '8px' }}>B/R Ajustado</th>
                  <th style={{ padding: '8px' }}>Acción Recomendada</th>
                </tr>
              </thead>
              <tbody>
                {trajectory.map((step, idx) => {
                  const isCurrent = Math.abs(step.price - simulatedPrice) < (targetPrice - stopLossPrice) / 20;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isCurrent ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px', fontWeight: isCurrent ? 800 : 500 }}>{step.date}</td>
                      <td className="font-mono" style={{ padding: '8px' }}>${step.price.toFixed(2)}</td>
                      <td className="font-mono" style={{ padding: '8px', color: step.unrealizedReturn >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                        {step.unrealizedReturn >= 0 ? '+' : ''}${step.unrealizedReturn.toFixed(2)}
                      </td>
                      <td className="font-mono" style={{ padding: '8px', color: 'var(--signal-bearish)' }}>${step.maxCapitalArriesgado.toFixed(2)}</td>
                      <td className="font-mono" style={{ padding: '8px', color: '#00E5FF' }}>${step.gananciaEsperada.toFixed(2)}</td>
                      <td className="font-mono" style={{ padding: '8px', fontWeight: 700 }}>{step.adjustedBR.toFixed(2)}</td>
                      <td style={{ padding: '8px' }}>
                        {step.adjustedBR >= 2.0 && <Badge variant="mint">Permitido Escalar</Badge>}
                        {step.adjustedBR >= 1.0 && step.adjustedBR < 2.0 && <Badge variant="neutral">Mantener</Badge>}
                        {step.adjustedBR >= 0.5 && step.adjustedBR < 1.0 && <Badge variant="sakura">Ceñir Stop</Badge>}
                        {step.adjustedBR < 0.5 && <Badge variant="bearish">Toma Parcial</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: VWAP Posicional */}
        {activeTab === 'vwap' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>VWAP de la Posición</div>
                <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-sakura)' }}>
                  ${vwapResult.positionVwap.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Promedio ponderado por UTs
                </div>
              </Card>

              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Estado vs VWAP</div>
                <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: vwapResult.trendSignal.positionState === 'ABOVE_VWAP' ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                  {vwapResult.trendSignal.distanceToVwapPct >= 0 ? '+' : ''}{vwapResult.trendSignal.distanceToVwapPct}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Actúa como {vwapResult.trendSignal.role}
                </div>
              </Card>

              <Card style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Eficiencia Institucional</div>
                <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: vwapResult.marketVwapComparison?.isSuperiorExecution ? 'var(--signal-bullish)' : 'var(--text-secondary)' }}>
                  {vwapResult.marketVwapComparison?.efficiencyPct ?? 0}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {vwapResult.marketVwapComparison?.isSuperiorExecution ? 'Ejecución Superior al Mercado' : 'En línea con el mercado'}
                </div>
              </Card>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              💡 Según los apuntes de administración de cartera, las compras realizadas por debajo del VWAP del mercado denotan alta eficiencia en la conformación de posición, y el VWAP posicional constituye la referencia ineludible de soporte dinámico.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
