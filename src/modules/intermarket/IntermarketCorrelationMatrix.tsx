import React, { useState } from 'react'

export interface IntermarketCorrelation {
  symbols: string[]
  labels: string[]
  matrix: number[][]
}

interface CorrelationMatrixProps {
  data: IntermarketCorrelation
}

export const IntermarketCorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ data }) => {
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null)

  if (!data || !data.symbols || data.symbols.length === 0) return null

  const { symbols, labels, matrix } = data

  const getCellColor = (val: number) => {
    if (val === 1.0) return 'rgba(255, 255, 255, 0.08)'
    if (val > 0) {
      // Positive correlation -> Emerald green
      const alpha = Math.min(Math.abs(val) * 0.7, 0.7)
      return `rgba(16, 185, 129, ${alpha})`
    } else {
      // Negative correlation -> Institutional blue
      const alpha = Math.min(Math.abs(val) * 0.7, 0.7)
      return `rgba(59, 130, 246, ${alpha})`
    }
  }

  const getEconomicInsight = (symA: string, symB: string, val: number) => {
    const pair = [symA, symB].sort().join('-')
    if (symA === symB) return 'Autocorrelación perfecta (1.00).'

    if (pair === 'SPY-TLT') {
      return val < 0
        ? 'Correlación negativa clásica (Risk-On / Flight-to-Safety). Régimen macroeconómico equilibrado.'
        : 'Correlación positiva inusual: Presión de liquidez y shock de tasas impactando ambos activos.'
    }
    if (pair === 'DBC-TLT') {
      return val < 0
        ? 'Relación inversa canónica: Materias primas al alza descuentan presiones inflacionarias que deprimen el precio de los bonos.'
        : 'Dinámica de estanflación o correlación transitoria.'
    }
    if (pair === 'GLD-SPY') {
      return val > 0
        ? 'Comportamiento pro-riesgo / expansión monetaria favoreciendo activos reales y acciones.'
        : 'El oro actúa como refugio puro frente a volatilidad bursátil.'
    }
    if (pair === 'BTC-SPY') {
      return val > 0.4
        ? 'Alta sensibilidad de Bitcoin al apetito por riesgo y condiciones de liquidez del mercado accionario.'
        : 'Divergencia cripto: Bitcoin cotizando con dinámica idiosincrática o descorrelación temporal.'
    }
    if (pair === 'HYG-SPY') {
      return val > 0.5
        ? 'Fuerte alineación con el ciclo crediticio: El mercado de bonos basura confirma la salud de los balances corporativos.'
        : 'Divergencia entre riesgo de crédito y mercado de acciones; prestar atención a posibles correcciones.'
    }

    return val > 0.3
      ? `Correlación positiva (+${val.toFixed(2)}): Ambos activos responden al mismo factor macroeconómico de liquidez o ciclo.`
      : val < -0.3
      ? `Correlación inversa (${val.toFixed(2)}): Comportamiento de cobertura o rotación de flujos de capital.`
      : `Descorrelación o relación neutral (${val.toFixed(2)}): Alta diversificación recíproca de cartera.`
  }

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.tag}>ESTRUCTURA DE DIVERSIFICACIÓN</div>
          <h3 style={styles.title}>Matriz de Correlación Intermarket (60D)</h3>
          <p style={styles.subtitle}>
            Coeficiente de correlación de Pearson calculado sobre los retornos diarios de los activos macro
          </p>
        </div>
        <div style={styles.legendBar}>
          <span style={styles.legendLabel}>Inversa (-1.0)</span>
          <div style={styles.gradientBar} />
          <span style={styles.legendLabel}>Positiva (+1.0)</span>
        </div>
      </div>

      <div style={styles.matrixWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.cornerHeader} />
              {symbols.map((sym, j) => (
                <th key={j} style={styles.colHeader}>
                  <div style={styles.colHeaderSymbol}>{sym}</div>
                  <div style={styles.colHeaderSub}>{labels[j] || ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((rowSym, i) => (
              <tr key={i}>
                <td style={styles.rowHeader}>
                  <div style={styles.rowHeaderSymbol}>{rowSym}</div>
                  <div style={styles.rowHeaderSub}>{labels[i] || ''}</div>
                </td>
                {symbols.map((_colSym, j) => {
                  const val = matrix[i]?.[j] ?? (i === j ? 1.0 : 0.0)
                  const isHovered = hoveredCell && hoveredCell.i === i && hoveredCell.j === j
                  const isSelf = i === j

                  return (
                    <td
                      key={j}
                      onMouseEnter={() => setHoveredCell({ i, j })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        ...styles.cell,
                        backgroundColor: getCellColor(val),
                        outline: isHovered ? '2px solid #F8FAFC' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        ...styles.cellVal,
                        fontWeight: isSelf ? 400 : 700,
                        color: isSelf ? '#64748B' : val > 0 ? '#E2E8F0' : '#93C5FD',
                      }}>
                        {isSelf ? '1.00' : val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insight Drawer at bottom */}
      {hoveredCell && (
        <div style={styles.insightBox}>
          <div style={styles.insightHeader}>
            <span>
              🔍 <strong>{symbols[hoveredCell.i]}</strong> vs <strong>{symbols[hoveredCell.j]}</strong>: Correlación{' '}
              <span style={{
                color: (matrix[hoveredCell.i]?.[hoveredCell.j] ?? 0) >= 0 ? '#10B981' : '#3B82F6',
              }}>
                {(matrix[hoveredCell.i]?.[hoveredCell.j] ?? 0) >= 0 ? '+' : ''}
                {(matrix[hoveredCell.i]?.[hoveredCell.j] ?? 0).toFixed(2)}
              </span>
            </span>
          </div>
          <p style={styles.insightText}>
            {getEconomicInsight(symbols[hoveredCell.i], symbols[hoveredCell.j], matrix[hoveredCell.i]?.[hoveredCell.j] ?? 0)}
          </p>
        </div>
      )}
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
    marginBottom: 16,
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
  legendBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: 600,
  },
  gradientBar: {
    width: 100,
    height: 8,
    borderRadius: 4,
    background: 'linear-gradient(to right, #3B82F6, #1E293B, #10B981)',
  },
  matrixWrapper: {
    overflowX: 'auto',
    marginTop: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 540,
  },
  cornerHeader: {
    width: 110,
  },
  colHeader: {
    padding: '8px 10px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  colHeaderSymbol: {
    fontSize: 12,
    fontWeight: 700,
    color: '#F8FAFC',
  },
  colHeaderSub: {
    fontSize: 10,
    color: '#64748B',
  },
  rowHeader: {
    padding: '8px 12px',
    textAlign: 'left',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    whiteSpace: 'nowrap',
  },
  rowHeaderSymbol: {
    fontSize: 12,
    fontWeight: 700,
    color: '#F8FAFC',
  },
  rowHeaderSub: {
    fontSize: 10,
    color: '#64748B',
  },
  cell: {
    padding: '12px 10px',
    textAlign: 'center',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'all 0.15s ease',
  },
  cellVal: {
    fontSize: 12,
    fontFamily: 'JetBrains Mono, monospace',
  },
  insightBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#11141D',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  insightHeader: {
    fontSize: 13,
    color: '#F8FAFC',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 1.5,
    margin: 0,
  },
}
