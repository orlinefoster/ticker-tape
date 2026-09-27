import { useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { calculateExoMetrics } from '@/modules/cartera/services/exoScalingEngine';

export function InteractiveExoWidget() {
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number>(90);
  const [targetPrice, setTargetPrice] = useState<number>(150);
  const [currentPrice, setCurrentPrice] = useState<number>(120);

  const metrics = calculateExoMetrics({
    symbol: 'ACTIVO-DEMO',
    entryPrice,
    stopLossPrice: stopLoss,
    targetPrice,
    currentPrice,
    shares: 10,
  });

  return (
    <Card
      variant="holo"
      style={{
        margin: '20px 0',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'rgba(15, 18, 28, 0.95)',
        border: '1px solid rgba(0, 229, 255, 0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
            🧪 Simulador Interactivo: Modelo EXO en Tiempo Real
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Desliza el precio actual para observar cómo se degrada el ratio B/R a medida que el trade madura.
          </span>
        </div>

        <Badge variant={metrics.recommendation === 'SCALE_DOWN' ? 'bearish' : metrics.recommendation === 'TIGHTEN_STOP' ? 'peach' : 'mint'}>
          {metrics.recommendationLabel}
        </Badge>
      </div>

      {/* Sliders and inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Entrada ($):</label>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#151926', color: '#fff', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--signal-bearish)' }}>Stop Loss ($):</label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#151926', color: 'var(--signal-bearish)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--signal-bullish)' }}>Target ($):</label>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(Number(e.target.value))}
            style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#151926', color: 'var(--signal-bullish)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#00E5FF' }}>Precio Actual ($):</label>
          <input
            type="number"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(Number(e.target.value))}
            style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#151926', color: '#00E5FF', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}
          />
        </div>
      </div>

      {/* Price Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <span>SL: ${stopLoss}</span>
          <span style={{ color: '#00E5FF', fontWeight: 800 }}>Precio Simulado: ${currentPrice}</span>
          <span>TP: ${targetPrice}</span>
        </div>
        <input
          type="range"
          min={stopLoss}
          max={targetPrice}
          step={0.5}
          value={currentPrice}
          onChange={(e) => setCurrentPrice(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#00E5FF' }}
        />
      </div>

      {/* Results grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>B/R Inicial</div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
            {metrics.initialBR.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>B/R Ajustado Actual</div>
          <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 900, color: metrics.recommendationColor }}>
            {metrics.adjustedBR.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Máx Riesgo Flotante</div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--signal-bearish)' }}>
            ${metrics.maxCapitalArriesgadoPerUnit.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Ganancia Esperada</div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00E5FF' }}>
            ${metrics.gananciaEsperadaPerUnit.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
        💬 <strong>Sugerencia de Operación:</strong> {metrics.suggestedActionText}
      </div>
    </Card>
  );
}
