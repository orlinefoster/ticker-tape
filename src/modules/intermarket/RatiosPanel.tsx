import React, { useState } from 'react'
import type { KeyRatios } from './index'

export interface MacroRatioItem {
  id: string
  name: string
  pair_label: string
  numerator_symbol: string
  denominator_symbol: string
  current_value: number
  change_1m_pct: number
  trend: 'Rising' | 'Falling' | 'Sideways'
  sma20: number
  sma50: number
  signal: 'bullish' | 'bearish' | 'neutral'
  description: string
  sparkline: number[]
  history_dates: string[]
  history_values: number[]
}

interface Props {
  ratios?: KeyRatios
  macroRatios?: MacroRatioItem[]
}

export const RatiosPanel: React.FC<Props> = ({ ratios, macroRatios = [] }) => {
  const [selectedRatioId, setSelectedRatioId] = useState<string | null>(null)

  // Fallback to legacy cards if macroRatios is empty
  const hasExtendedRatios = macroRatios && macroRatios.length > 0

  const activeRatio = macroRatios.find(r => r.id === selectedRatioId)

  const renderSparkline = (data: number[], color: string) => {
    if (!data || data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 90
    const h = 28
    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((d - min) / range) * (h - 4) - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    return (
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    )
  }

  const renderDetailChart = (item: MacroRatioItem) => {
    const data = item.history_values
    const dates = item.history_dates
    if (!data || data.length < 2) return null

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 820
    const h = 180
    const padL = 45
    const padR = 20
    const padT = 15
    const padB = 25
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    const points = data
      .map((d, i) => {
        const x = padL + (i / (data.length - 1)) * plotW
        const y = padT + plotH - ((d - min) / range) * plotH
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    const isPositive = item.change_1m_pct >= 0
    const strokeColor = isPositive ? '#10B981' : '#EF4444'

    return (
      <div style={styles.detailContainer}>
        <div style={styles.detailHeader}>
          <div>
            <h4 style={styles.detailTitle}>
              📈 Serie Histórica: {item.name} ({item.pair_label})
            </h4>
            <p style={styles.detailDesc}>{item.description}</p>
          </div>
          <button onClick={() => setSelectedRatioId(null)} style={styles.closeDetailBtn}>
            ✕ Cerrar Detalle
          </button>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          <line x1={padL} y1={padT} x2={padL + plotW} y2={padT} stroke="rgba(255,255,255,0.06)" />
          <line x1={padL} y1={padT + plotH / 2} x2={padL + plotW} y2={padT + plotH / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.08)" />

          {/* Min / Max Labels */}
          <text x={padL - 6} y={padT + 4} fill="#64748B" fontSize="10" textAnchor="end">{max.toFixed(3)}</text>
          <text x={padL - 6} y={padT + plotH} fill="#64748B" fontSize="10" textAnchor="end">{min.toFixed(3)}</text>

          {/* Date labels */}
          {dates.length > 0 && (
            <>
              <text x={padL} y={padT + plotH + 16} fill="#64748B" fontSize="10" textAnchor="start">{dates[0]}</text>
              <text x={padL + plotW} y={padT + plotH + 16} fill="#64748B" fontSize="10" textAnchor="end">{dates[dates.length - 1]}</text>
            </>
          )}

          {/* Ratio Line */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>

        <div style={styles.detailStatsRow}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Valor Actual</span>
            <span style={styles.statVal}>{item.current_value.toFixed(4)}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Retorno 1 Mes</span>
            <span style={{ ...styles.statVal, color: item.change_1m_pct >= 0 ? '#10B981' : '#EF4444' }}>
              {item.change_1m_pct >= 0 ? '+' : ''}{item.change_1m_pct.toFixed(2)}%
            </span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Media SMA 20</span>
            <span style={styles.statVal}>{item.sma20.toFixed(4)}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Media SMA 50</span>
            <span style={styles.statVal}>{item.sma50.toFixed(4)}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Señal Macro</span>
            <span style={{
              ...styles.statVal,
              color: item.signal === 'bullish' ? '#10B981' : item.signal === 'bearish' ? '#EF4444' : '#F59E0B',
            }}>
              {item.signal === 'bullish' ? 'Alcista' : item.signal === 'bearish' ? 'Bajista' : 'Neutral'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.tag}>PULSO DE MERCADO</div>
          <h3 style={styles.title}>Tablero de Ratios Macro & Liquidez</h3>
          <p style={styles.subtitle}>
            Relaciones relativas cuantitativas entre clases de activos y diferenciales de crédito
          </p>
        </div>
        <div style={styles.helperText}>
          <span>💡 Clic en cualquier tarjeta para ver su gráfico histórico</span>
        </div>
      </div>

      {/* Expanded Ratio History Chart Drawer */}
      {activeRatio && renderDetailChart(activeRatio)}

      {/* Ratios Grid */}
      {hasExtendedRatios ? (
        <div style={styles.grid}>
          {macroRatios.map(item => {
            const isSelected = item.id === selectedRatioId
            const isPositive = item.change_1m_pct >= 0
            const sparkColor = isPositive ? '#10B981' : '#EF4444'

            return (
              <div
                key={item.id}
                onClick={() => setSelectedRatioId(isSelected ? null : item.id)}
                style={{
                  ...styles.ratioCard,
                  borderColor: isSelected ? 'var(--accent, #3B82F6)' : 'rgba(255, 255, 255, 0.08)',
                  backgroundColor: isSelected ? '#161B29' : '#11141D',
                }}
              >
                <div style={styles.cardTop}>
                  <span style={styles.pairBadge}>{item.pair_label}</span>
                  <div style={styles.sparkWrapper}>
                    {renderSparkline(item.sparkline, sparkColor)}
                  </div>
                </div>

                <div style={styles.cardMid}>
                  <div style={styles.ratioName}>{item.name}</div>
                  <div style={styles.valRow}>
                    <span style={styles.currentVal}>{item.current_value.toFixed(3)}</span>
                    <span style={{
                      ...styles.changeBadge,
                      backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: isPositive ? '#10B981' : '#EF4444',
                    }}>
                      {isPositive ? '↗ +' : '↘ '}{item.change_1m_pct.toFixed(1)}% (1M)
                    </span>
                  </div>
                </div>

                <div style={styles.cardBottom}>
                  <span style={styles.trendText}>
                    Tendencia: <strong style={{ color: item.trend === 'Rising' ? '#10B981' : item.trend === 'Falling' ? '#EF4444' : '#F59E0B' }}>
                      {item.trend === 'Rising' ? 'Subiendo' : item.trend === 'Falling' ? 'Bajando' : 'Lateral'}
                    </strong>
                  </span>
                  <span style={{
                    ...styles.signalDot,
                    backgroundColor: item.signal === 'bullish' ? '#10B981' : item.signal === 'bearish' ? '#EF4444' : '#F59E0B',
                  }} title={item.signal} />
                </div>
              </div>
            )
          })}
        </div>
      ) : ratios ? (
        /* Legacy fallback */
        <div style={styles.grid}>
          <div style={styles.ratioCard}>
            <span style={styles.pairBadge}>SPY/TLT</span>
            <div style={styles.ratioName}>Stock / Bond</div>
            <div style={styles.currentVal}>{ratios.stock_bond.toFixed(2)}</div>
            <div style={styles.trendText}>Tendencia: {ratios.stock_bond_trend}</div>
          </div>
          <div style={styles.ratioCard}>
            <span style={styles.pairBadge}>Cyclical/Defensive</span>
            <div style={styles.ratioName}>Cíclicos vs Defensivos</div>
            <div style={styles.currentVal}>{ratios.cyclical_defensive.toFixed(2)}</div>
            <div style={styles.trendText}>Tendencia: {ratios.cyclical_defensive_trend}</div>
          </div>
          <div style={styles.ratioCard}>
            <span style={styles.pairBadge}>DBC/TLT</span>
            <div style={styles.ratioName}>Commodity / Bond</div>
            <div style={styles.currentVal}>{ratios.commodity_bond.toFixed(2)}</div>
            <div style={styles.trendText}>Tendencia: {ratios.commodity_bond_trend}</div>
          </div>
          <div style={styles.ratioCard}>
            <span style={styles.pairBadge}>DXY</span>
            <div style={styles.ratioName}>Índice Dólar</div>
            <div style={styles.currentVal}>{ratios.dollar_ratio.toFixed(2)}</div>
            <div style={styles.trendText}>Tendencia: {ratios.dollar_trend}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-surface-card, #151926)',
    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: 16,
  },
  tag: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--accent, #3B82F6)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    margin: '4px 0 0',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    padding: '6px 10px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
  },
  ratioCard: {
    border: '1px solid',
    borderRadius: 10,
    padding: 16,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pairBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#93C5FD',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontFamily: 'JetBrains Mono, monospace',
  },
  sparkWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  cardMid: {
    marginBottom: 10,
  },
  ratioName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#E2E8F0',
    marginBottom: 6,
  },
  valRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  },
  currentVal: {
    fontSize: 18,
    fontWeight: 800,
    color: '#F8FAFC',
    fontFamily: 'JetBrains Mono, monospace',
  },
  changeBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
    fontSize: 11,
  },
  trendText: {
    color: '#94A3B8',
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  detailContainer: {
    backgroundColor: '#0F131D',
    border: '1px solid var(--accent, #3B82F6)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#F8FAFC',
    margin: 0,
  },
  detailDesc: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '4px 0 0',
  },
  closeDetailBtn: {
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#E2E8F0',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  detailStatsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    marginTop: 14,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  statBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 8,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  statVal: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'JetBrains Mono, monospace',
    color: '#F8FAFC',
  },
}
