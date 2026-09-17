import React, { useState } from 'react';
import type { AnalystCandidate, OperatorPlan, OperatorSettings, SizingMethod } from '../types';
import { buildOperatorExecutionPlan } from '../engine';

interface OperatorDeskViewProps {
  candidates: AnalystCandidate[];
  initialSettings?: Partial<OperatorSettings>;
}

export function OperatorDeskView({ candidates, initialSettings }: OperatorDeskViewProps) {
  const [settings, setSettings] = useState<OperatorSettings>({
    totalCapital: initialSettings?.totalCapital ?? 50000,
    riskPerTradePct: initialSettings?.riskPerTradePct ?? 0.015,
    maxPortfolioHeatPct: initialSettings?.maxPortfolioHeatPct ?? 0.06,
    sizingMethod: initialSettings?.sizingMethod ?? 'fixed_risk',
    atrPeriod: 14,
    defaultStopPct: 0.05,
  });

  const [copied, setCopied] = useState(false);

  // Recalculate plan dynamically when settings change
  const plan: OperatorPlan = buildOperatorExecutionPlan(candidates, settings);

  const handleCopyTicket = () => {
    const textLines = [
      `=== TICKET DE EJECUCIÓN: CAPA OPERADOR ===`,
      `Fecha: ${new Date().toLocaleString()}`,
      `Capital Total: $${settings.totalCapital.toLocaleString()}`,
      `Método de Sizing: ${settings.sizingMethod.toUpperCase()} | Riesgo/Trade: ${(settings.riskPerTradePct * 100).toFixed(1)}% | Heat Máx: ${(settings.maxPortfolioHeatPct * 100).toFixed(1)}%`,
      `Riesgo Total Asignado: $${plan.totalPortfolioRiskDollar.toLocaleString()} (${plan.totalPortfolioRiskPct}%)`,
      `Asignación Total: $${plan.totalAllocatedDollar.toLocaleString()} (${plan.totalAllocatedPct}%)`,
      `Sharpe Proyectado: ${plan.projectedSharpe} | Sortino: ${plan.projectedSortino} | Max DD Est: ${plan.maxEstimatedDrawdownPct}%`,
      ``,
      `--- ÓRDENES PLANIFICADAS ---`,
      ...plan.trades.map((t, idx) => 
        `[#${idx + 1}] ${t.symbol} (${t.quadrant})\n  Acción: COMPRA ${t.positionShares} un ($${t.positionDollarValue.toLocaleString()} / ${t.allocationPct}% portf)\n  Entry: $${t.entryPrice} | Stop Loss: $${t.stopLossPrice} (-$${t.dollarRisk} / ${t.riskPctOfCapital}% riesgo)\n  TP1: $${t.takeProfit1Price} | TP2: $${t.takeProfit2Price} | R:R: ${t.riskRewardRatio}:1\n  Setup: ${t.rationale}`
      ),
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={styles.container}>
      {/* 1. Risk Parameters Control Panel */}
      <div style={styles.controlPanel}>
        <div style={styles.controlHeader}>
          <div>
            <h3 style={styles.title}>💼 Capa Operador: Risk & Money Management Desk</h3>
            <p style={styles.subtitle}>
              Dimensionamiento matemático de posición, control de riesgo total de cartera y proyección de curva de capital
            </p>
          </div>

          <button onClick={handleCopyTicket} style={styles.copyButton}>
            {copied ? '✅ ¡Ticket Copiado!' : '📋 Copiar Ticket de Órdenes'}
          </button>
        </div>

        <div style={styles.inputsGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Capital Total de Cartera ($ USD)</label>
            <input
              type="number"
              value={settings.totalCapital}
              onChange={(e) => setSettings({ ...settings, totalCapital: Math.max(100, Number(e.target.value)) })}
              style={styles.input}
              step={1000}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Riesgo Máximo por Operación (% Capital)</label>
            <select
              value={settings.riskPerTradePct}
              onChange={(e) => setSettings({ ...settings, riskPerTradePct: Number(e.target.value) })}
              style={styles.select}
            >
              <option value={0.005}>0.5% (Ultraconservador)</option>
              <option value={0.01}>1.0% (Conservador Institucional)</option>
              <option value={0.015}>1.5% (Moderado / Estándar)</option>
              <option value={0.02}>2.0% (Agresivo)</option>
              <option value={0.03}>3.0% (Alto Riesgo)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Límite de Portfolio Heat (% Riesgo Total)</label>
            <select
              value={settings.maxPortfolioHeatPct}
              onChange={(e) => setSettings({ ...settings, maxPortfolioHeatPct: Number(e.target.value) })}
              style={styles.select}
            >
              <option value={0.04}>4.0% (Defensivo)</option>
              <option value={0.06}>6.0% (Recomendado)</option>
              <option value={0.08}>8.0% (Expansivo)</option>
              <option value={0.10}>10.0% (Máximo Techo)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Modelo de Dimensionamiento</label>
            <select
              value={settings.sizingMethod}
              onChange={(e) => setSettings({ ...settings, sizingMethod: e.target.value as SizingMethod })}
              style={styles.select}
            >
              <option value="fixed_risk">Fixed Fractional Risk ($ Riesgo / Distancia Stop)</option>
              <option value="atr_volatility">Volatility Sizing (Ajustado por ATR)</option>
              <option value="half_kelly">Half-Kelly Criterion (Optimización Matemática)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Portfolio Risk & Return KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Capital Asignado</div>
          <div style={styles.kpiValue}>${plan.totalAllocatedDollar.toLocaleString()}</div>
          <div style={styles.kpiSub}>{plan.totalAllocatedPct}% del capital total</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Riesgo de Cartera Asumido</div>
          <div style={{ ...styles.kpiValue, color: plan.totalPortfolioRiskPct > 5 ? '#ff9800' : '#4caf50' }}>
            ${plan.totalPortfolioRiskDollar.toLocaleString()}
          </div>
          <div style={styles.kpiSub}>{plan.totalPortfolioRiskPct}% (Límite: {(settings.maxPortfolioHeatPct * 100).toFixed(1)}%)</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Sharpe Ratio Proyectado</div>
          <div style={{ ...styles.kpiValue, color: '#00e5ff' }}>{plan.projectedSharpe}</div>
          <div style={styles.kpiSub}>Sortino: {plan.projectedSortino}</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Drawdown Máx. Estimado</div>
          <div style={{ ...styles.kpiValue, color: '#f44336' }}>-{plan.maxEstimatedDrawdownPct}%</div>
          <div style={styles.kpiSub}>Control de volatilidad activo</div>
        </div>
      </div>

      {/* 3. Execution Orders Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Plan de Posiciones y Puntos de Entrada/Salida ({plan.trades.length} Órdenes)
          </h4>
          <span style={styles.methodBadge}>
            Método: <strong>{settings.sizingMethod.toUpperCase()}</strong>
          </span>
        </div>

        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Activo</th>
                <th style={styles.th}>Cuadrante</th>
                <th style={styles.th}>Precio Entrada</th>
                <th style={styles.th}>Stop Loss (Invalidación)</th>
                <th style={styles.th}>Take Profit 1 (1:2)</th>
                <th style={styles.th}>Take Profit 2 (1:3)</th>
                <th style={styles.th}>R:R</th>
                <th style={styles.th}>Tamaño (Unid)</th>
                <th style={styles.th}>Capital Asignado</th>
                <th style={styles.th}>Riesgo en $</th>
              </tr>
            </thead>
            <tbody>
              {plan.trades.map((t) => (
                <tr key={t.symbol} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {t.symbol}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: t.quadrant === 'Leading' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(33, 150, 243, 0.15)',
                      color: t.quadrant === 'Leading' ? '#4caf50' : '#2196f3',
                    }}>
                      {t.quadrant}
                    </span>
                  </td>
                  <td style={styles.td}>${t.entryPrice.toLocaleString()}</td>
                  <td style={{ ...styles.td, color: '#f44336', fontWeight: '600' }}>
                    ${t.stopLossPrice.toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, color: '#4caf50', fontWeight: '600' }}>
                    ${t.takeProfit1Price.toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, color: '#00e5ff', fontWeight: '600' }}>
                    ${t.takeProfit2Price.toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{t.riskRewardRatio}:1</td>
                  <td style={styles.td}>{t.positionShares.toLocaleString()}</td>
                  <td style={styles.td}>
                    <strong>${t.positionDollarValue.toLocaleString()}</strong> ({t.allocationPct}%)
                  </td>
                  <td style={{ ...styles.td, color: '#f44336' }}>
                    -${t.dollarRisk.toLocaleString()} ({t.riskPctOfCapital}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Equity Curve & Drawdown Projection Simulator */}
      <div style={styles.chartCard}>
        <div style={styles.chartCardHeader}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              📈 Simulación de Equity Curve (Proyección Top-Down vs Baseline)
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Proyección de 30 períodos aplicando el edge de selección de fuerza relativa y control estricto de riesgo
            </p>
          </div>
          <div style={styles.chartLegend}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#00e5ff' }}>
              <span style={{ width: 12, height: 3, backgroundColor: '#00e5ff', borderRadius: 2 }} />
              Cartera con Top-Down Engine
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              <span style={{ width: 12, height: 3, backgroundColor: 'var(--text-tertiary)', borderRadius: 2 }} />
              Baseline Pasivo
            </span>
          </div>
        </div>

        {/* SVG Equity Curve Chart */}
        <div style={styles.svgWrapper}>
          {(() => {
            const width = 800;
            const height = 260;
            const padX = 60;
            const padY = 30;
            const plotW = width - padX * 2;
            const plotH = height - padY * 2;

            const allVals = plan.equityCurve.flatMap((p) => [p.baselineEquity, p.projectedEquity]);
            const minVal = Math.min(...allVals) * 0.98;
            const maxVal = Math.max(...allVals) * 1.02;

            const getX = (idx: number) => padX + (idx / (plan.equityCurve.length - 1)) * plotW;
            const getY = (val: number) => padY + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

            const basePoints = plan.equityCurve.map((p, i) => `${getX(i)},${getY(p.baselineEquity)}`).join(' ');
            const projPoints = plan.equityCurve.map((p, i) => `${getX(i)},${getY(p.projectedEquity)}`).join(' ');

            return (
              <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padY + plotH * ratio;
                  const val = maxVal - (maxVal - minVal) * ratio;
                  return (
                    <g key={ratio}>
                      <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                      <text x={padX - 8} y={y + 4} fill="var(--text-tertiary)" fontSize="10" textAnchor="end">
                        ${Math.round(val).toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {/* Baseline path */}
                <polyline fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="4 4" points={basePoints} />

                {/* Projected path */}
                <polyline fill="none" stroke="#00e5ff" strokeWidth="2.5" points={projPoints} />

                {/* Dots on endpoints */}
                {plan.equityCurve.length > 0 && (
                  <circle
                    cx={getX(plan.equityCurve.length - 1)}
                    cy={getY(plan.equityCurve[plan.equityCurve.length - 1].projectedEquity)}
                    r="5"
                    fill="#00e5ff"
                  />
                )}
              </svg>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  controlPanel: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  controlHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  copyButton: {
    padding: '10px 18px',
    backgroundColor: '#00e5ff',
    color: '#000',
    fontWeight: 'bold',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  inputsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
  },
  select: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    padding: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  kpiLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
  },
  kpiValue: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tableCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.85rem',
  },
  th: {
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '10px 8px',
  },
  chartCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  chartCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  chartLegend: {
    display: 'flex',
    gap: '16px',
  },
  svgWrapper: {
    width: '100%',
    height: '260px',
  },
};
