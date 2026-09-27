import React, { useState, useMemo } from 'react'
import { Card, Button, Badge } from '@/components/ui'
import type { CorrelationMatrix } from './types'

interface Props {
  correlations: CorrelationMatrix
  hrpOrder?: string[]
  windowDays?: number
}

/**
 * Institutional Correlation Heatmap with HRP Quasi-diagonalization Reordering.
 *
 * Supports switching between original symbol order and Hierarchical Risk Parity (HRP)
 * tree order to visually expose clusters along the diagonal.
 */
export const CorrelationHeatmap: React.FC<Props> = ({
  correlations,
  hrpOrder = [],
  windowDays = 63,
}) => {
  const [useHrpOrder, setUseHrpOrder] = useState<boolean>(true)

  // Determine active ordered symbols
  const activeSymbols = useMemo(() => {
    if (useHrpOrder && hrpOrder.length === correlations.symbols.length) {
      return hrpOrder
    }
    return correlations.symbols
  }, [useHrpOrder, hrpOrder, correlations.symbols])

  // Construct active matrix re-indexed by activeSymbols
  const activeMatrix = useMemo(() => {
    const rawSyms = correlations.symbols
    const rawMatrix = correlations.correlations

    const indexMap = new Map<string, number>()
    rawSyms.forEach((sym, idx) => indexMap.set(sym, idx))

    return activeSymbols.map((rowSym) => {
      const origRowIdx = indexMap.get(rowSym) ?? 0
      return activeSymbols.map((colSym) => {
        const origColIdx = indexMap.get(colSym) ?? 0
        return rawMatrix[origRowIdx]?.[origColIdx] ?? 0
      })
    })
  }, [activeSymbols, correlations])

  const cellSize = useMemo(() => {
    const max = Math.max(activeSymbols.length, 1)
    return Math.min(68, Math.max(38, 480 / max))
  }, [activeSymbols.length])

  if (activeSymbols.length === 0) {
    return (
      <div style={styles.empty}>
        No correlation data available.
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header & Controls */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <h3 style={styles.title}>Matriz de Correlación Interactivo</h3>
            <Badge variant="neutral">Ventana {windowDays}d</Badge>
            {useHrpOrder && hrpOrder.length > 0 && (
              <Badge variant="primary">Agrupamiento HRP Activo</Badge>
            )}
          </div>
          <p style={styles.subtitle}>
            {useHrpOrder
              ? 'Filas y columnas ordenadas por Árbol Jerárquico (HRP). Los bloques en la diagonal representan factores de riesgo comunes.'
              : 'Orden original de entrada de símbolos.'}
          </p>
        </div>

        {hrpOrder.length > 0 && (
          <div style={styles.controls}>
            <Button
              size="sm"
              variant={useHrpOrder ? 'primary' : 'outline'}
              onClick={() => setUseHrpOrder(!useHrpOrder)}
            >
              {useHrpOrder ? '✓ Orden HRP (Clústeres)' : 'Usar Orden HRP (Clústeres)'}
            </Button>
          </div>
        )}
      </div>

      {/* Grid Heatmap Table */}
      <div style={styles.tableWrapper}>
        <div style={styles.scrollArea}>
          {/* Header row (symbols across top) */}
          <div style={styles.headerRow}>
            <div style={{ ...styles.cornerCell, width: cellSize * 1.4, minWidth: cellSize * 1.4 }} />
            {activeSymbols.map((sym) => (
              <div
                key={sym}
                style={{
                  ...styles.headerCell,
                  width: cellSize,
                  minWidth: cellSize,
                  height: cellSize * 1.4,
                }}
                title={sym}
              >
                <span style={styles.rotatedHeader}>{sym}</span>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {activeSymbols.map((rowSym, i) => (
            <div key={rowSym} style={styles.dataRow}>
              <div
                style={{
                  ...styles.rowLabel,
                  width: cellSize * 1.4,
                  minWidth: cellSize * 1.4,
                  height: cellSize,
                }}
                title={rowSym}
              >
                {rowSym}
              </div>

              {activeSymbols.map((colSym, j) => {
                const value = activeMatrix[i]?.[j] ?? 0
                const isDiag = i === j
                return (
                  <div
                    key={`${rowSym}-${colSym}`}
                    style={{
                      ...styles.cell,
                      width: cellSize,
                      minWidth: cellSize,
                      height: cellSize,
                      backgroundColor: isDiag ? 'rgba(99, 102, 241, 0.2)' : correlationColor(value),
                      border: isDiag ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                    title={`${rowSym} / ${colSym}: ${value.toFixed(4)}`}
                  >
                    <span
                      style={{
                        ...styles.cellValue,
                        color: isDiag ? 'var(--accent)' : getTextColor(value),
                        fontSize: Math.max(9, Math.min(12, cellSize * 0.24)),
                        fontWeight: isDiag ? 700 : 500,
                      }}
                    >
                      {value.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend Bar */}
      <div style={styles.legendRow}>
        <div style={styles.legendScale}>
          <span style={styles.legendTag}>-1.0 (Inversa)</span>
          <div style={styles.gradientBar} />
          <span style={styles.legendTag}>0.0 (Descorrelacionado)</span>
          <div style={styles.gradientBarPos} />
          <span style={styles.legendTag}>+1.0 (Sincrónico)</span>
        </div>
      </div>

      {/* Educational Rebalancing Insights */}
      <Card variant="filled" style={styles.eduCard}>
        <div style={styles.eduHeader}>
          <span style={styles.eduIcon}>💡</span>
          <span style={styles.eduTitle}>
            CÓMO APLICAR ESTA INFORMACIÓN AL REBALANCEO DE CARTERA (HRP)
          </span>
        </div>
        <div style={styles.eduBody}>
          <div style={styles.eduPoint}>
            <strong>1. Detección de Falsa Diversificación:</strong>
            <p>
              Si varios activos forman un bloque verde intenso a lo largo de la diagonal (ej. varios
              activos tecnológicos o criptomonedas), compartirán casi el 100% de la caída ante un shock.
              Asignar pesos iguales a cada uno no es diversificar; es sobreponderar ese bloque.
            </p>
          </div>
          <div style={styles.eduPoint}>
            <strong>2. Asignación Jerárquica de Riesgo:</strong>
            <p>
              En lugar de dividir el 100% del capital entre $N$ activos, divide primero el capital entre
              los <em>bloques independientes</em> (ej. 50% al clúster de Renta Variable, 50% al clúster
              de Refugio / Bonos). Luego, dentro de cada clúster, asigna mayor peso a los activos de
              menor volatilidad.
            </p>
          </div>
          <div style={styles.eduPoint}>
            <strong>3. Activos Descorrelacionados (Celdas Oscuras o Rojas):</strong>
            <p>
              Los activos que muestran celdas oscuras ($\rho \approx 0$) o rojas ($\rho &lt; 0$) frente
              al resto son los verdaderos amortiguadores de drawdown. Son los activos ideales para
              rebalancear vendiendo lo que subió y comprando lo que bajó.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

/**
 * Institutional dark-theme color interpolation for correlation:
 * - Positive (> 0): Emerald green glow on dark slate
 * - Zero (0): Dark charcoal / navy
 * - Negative (< 0): Crimson red glow on dark slate
 */
function correlationColor(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value))
  if (clamped >= 0) {
    // 0 -> rgba(16, 185, 129, 0.05), 1 -> rgba(16, 185, 129, 0.8)
    const alpha = (clamped * 0.75 + 0.05).toFixed(2)
    return `rgba(16, 185, 129, ${alpha})`
  } else {
    // 0 -> rgba(239, 68, 68, 0.05), -1 -> rgba(239, 68, 68, 0.8)
    const alpha = (Math.abs(clamped) * 0.75 + 0.05).toFixed(2)
    return `rgba(239, 68, 68, ${alpha})`
  }
}

function getTextColor(value: number): string {
  const abs = Math.abs(value)
  if (abs > 0.45) return '#ffffff'
  return 'var(--text-secondary, #94a3b8)'
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  controls: {
    display: 'flex',
    gap: '8px',
  },
  tableWrapper: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    overflowX: 'auto',
  },
  scrollArea: {
    display: 'inline-block',
    minWidth: '100%',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  cornerCell: {
    flexShrink: 0,
  },
  headerCell: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },
  rotatedHeader: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono, monospace)',
    whiteSpace: 'nowrap',
  },
  dataRow: {
    display: 'flex',
    alignItems: 'center',
  },
  rowLabel: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '12px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  cell: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    transition: 'transform 0.1s ease',
    margin: '1px',
  },
  cellValue: {
    fontFamily: 'var(--font-mono, monospace)',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-secondary)',
  },
  legendRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0',
  },
  legendScale: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  gradientBar: {
    width: '80px',
    height: '10px',
    borderRadius: '4px',
    background: 'linear-gradient(to right, rgba(239, 68, 68, 0.8), rgba(30, 41, 59, 0.5))',
  },
  gradientBarPos: {
    width: '80px',
    height: '10px',
    borderRadius: '4px',
    background: 'linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(16, 185, 129, 0.8))',
  },
  legendTag: {
    fontSize: '10px',
  },
  eduCard: {
    padding: '16px',
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  eduHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  eduIcon: {
    fontSize: '16px',
  },
  eduTitle: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  eduBody: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  eduPoint: {
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
}
