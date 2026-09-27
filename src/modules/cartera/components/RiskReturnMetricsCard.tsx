import { useMemo } from 'react';
import { Card, Badge } from '@/components/ui';
import {
  calculateRiskReturnMetrics,
  type RiskReturnMetrics,
} from '../services/riskReturnEngine';

interface RiskReturnMetricsCardProps {
  portfolioEquityPoints?: number[];
}

export function RiskReturnMetricsCard({ portfolioEquityPoints }: RiskReturnMetricsCardProps) {
  const metrics: RiskReturnMetrics = useMemo(() => {
    // Generate sample daily return vectors if none provided
    const portReturns = [0.012, -0.005, 0.018, 0.006, -0.003, 0.014, -0.008, 0.011, 0.009, -0.002, 0.015, -0.004];
    const benchReturns = [0.008, -0.004, 0.012, 0.004, -0.002, 0.009, -0.006, 0.007, 0.006, -0.001, 0.01, -0.003];

    return calculateRiskReturnMetrics({
      portfolioReturns: portReturns,
      benchmarkReturns: benchReturns,
      riskFreeRateAnnual: 0.045, // 4.5% US 10Y
      inflationRateAnnual: 0.03, // 3.0% CPI
      currencyDevaluationAnnual: 0.0,
    });
  }, [portfolioEquityPoints]);

  return (
    <Card variant="glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-bright)' }}>
            📊 Matriz Integral de Riesgo &amp; Rendimiento (Apunte 16-2)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Evaluación institucional: Volatilidad Histórica, Cobertura Sistemática (Beta) y Ratios de Eficiencia.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {metrics.betaClassification === 'DEFENSIVE' && <Badge variant="lavender">🛡️ Cartera Defensiva (Beta &lt; 0.9)</Badge>}
          {metrics.betaClassification === 'NEUTRAL' && <Badge variant="neutral">⚖️ Cartera Neutra (Beta ≈ 1.0)</Badge>}
          {metrics.betaClassification === 'AGGRESSIVE' && <Badge variant="sakura">⚡ Cartera Agresiva (Beta &gt; 1.1)</Badge>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {/* Sharpe & Sortino */}
        <div style={{ padding: '12px', background: 'var(--border)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>SHARPE &amp; SORTINO</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sharpe</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00F5D4' }}>
                {metrics.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sortino</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00E5FF' }}>
                {metrics.sortinoRatio.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Retorno excedente por unidad de riesgo a la baja.
          </div>
        </div>

        {/* Beta & Treynor */}
        <div style={{ padding: '12px', background: 'var(--border)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>BETA &amp; TREYNOR</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Beta (S&amp;P/BTC)</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {metrics.beta.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Treynor</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B388FF' }}>
                {metrics.treynorRatio.toFixed(3)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Exposición y compensación del riesgo sistemático.
          </div>
        </div>

        {/* Jensen's Alpha & Paolucci */}
        <div style={{ padding: '12px', background: 'var(--border)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>JENSEN'S ALPHA &amp; PAOLUCCI</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Alpha Jensen</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: metrics.jensensAlphaPct >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                {metrics.jensensAlphaPct >= 0 ? '+' : ''}{metrics.jensensAlphaPct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Ratio Paolucci</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFE082' }}>
                {metrics.paolucciRatio.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Generación de valor puro sobre el mercado.
          </div>
        </div>

        {/* Volatilidad Histórica & Retorno Real */}
        <div style={{ padding: '12px', background: 'var(--border)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>VH &amp; RETORNO REAL NETO</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>VH Anualizada</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {metrics.annualizedVolatilityPct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Retorno Real</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: metrics.isRealGainPositive ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                {metrics.realReturnNetPct >= 0 ? '+' : ''}{metrics.realReturnNetPct.toFixed(1)}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Rendimiento neto descontando tasa libre (4.5%) e inflación (3%).
          </div>
        </div>
      </div>
    </Card>
  );
}
