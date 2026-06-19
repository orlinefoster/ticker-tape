import { useMemo } from 'react'

interface CorrelationMatrix {
  symbols: string[]
  correlations: number[][]
}

interface Props {
  correlations: CorrelationMatrix
}

/**
 * Visual correlation matrix heatmap.
 *
 * Displays a grid of coloured cells where:
 * - Green (#4caf50) = perfect positive correlation (1.0)
 * - White (#ffffff) = no correlation (0.0)
 * - Red (#f44336) = perfect negative correlation (-1.0)
 */
export function CorrelationHeatmap({ correlations }: Props) {
  const { symbols, correlations: matrix } = correlations

  const cellSize = useMemo(() => {
    const max = Math.max(symbols.length, 1)
    return Math.min(80, Math.max(40, 520 / max))
  }, [symbols.length])

  if (symbols.length === 0) {
    return (
      <div style={styles.empty}>
        No correlation data available.
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Correlation Matrix (63-day)</h3>

      <div style={styles.tableWrapper}>
        {/* Header row (symbols across top) */}
        <div style={styles.headerRow}>
          <div style={{ ...styles.cornerCell, width: cellSize * 1.5, minWidth: cellSize * 1.5 }} />
          {symbols.map((sym) => (
            <div
              key={sym}
              style={{
                ...styles.headerCell,
                width: cellSize,
                minWidth: cellSize,
                writingMode: 'vertical-lr' as const,
                transform: 'rotate(180deg)',
                height: cellSize * 2,
              }}
              title={sym}
            >
              {sym}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {symbols.map((rowSym, i) => (
          <div key={rowSym} style={styles.dataRow}>
            <div
              style={{
                ...styles.rowLabel,
                width: cellSize * 1.5,
                minWidth: cellSize * 1.5,
                height: cellSize,
              }}
              title={rowSym}
            >
              {rowSym}
            </div>
            {symbols.map((colSym, j) => {
              const value = matrix[i]?.[j] ?? 0
              return (
                <div
                  key={`${i}-${j}`}
                  style={{
                    ...styles.cell,
                    width: cellSize,
                    minWidth: cellSize,
                    height: cellSize,
                    backgroundColor: correlationColor(value),
                    cursor: i !== j ? 'pointer' : 'default',
                  }}
                  title={`${rowSym} / ${colSym}: ${value.toFixed(4)}`}
                >
                  <span
                    style={{
                      ...styles.cellValue,
                      color: getTextColor(value),
                      fontSize: Math.max(9, Math.min(13, cellSize * 0.22)),
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

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendLabel}>-1.0</span>
        <div style={styles.legendGradient} />
        <span style={styles.legendLabel}>0.0</span>
        <div style={styles.legendGradient2} />
        <span style={styles.legendLabel}>+1.0</span>
      </div>
    </div>
  )
}

/**
 * Map a correlation value to a background colour.
 *
 * Green → White → Red scale:
 *   1.0 → #4caf50 (green)
 *   0.0 → #ffffff (white)
 *  -1.0 → #f44336 (red)
 */
function correlationColor(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value))
  if (clamped >= 0) {
    // Interpolate green → white
    const r = 76 + Math.round((255 - 76) * (1 - clamped))
    const g = 175 + Math.round((255 - 175) * (1 - clamped))
    const b = 80 + Math.round((255 - 80) * (1 - clamped))
    return `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`
  } else {
    // Interpolate white → red
    const r = 244
    const g = Math.round(255 - (255 - 67) * Math.abs(clamped))
    const b = Math.round(255 - (255 - 54) * Math.abs(clamped))
    return `rgb(${Math.min(255, r)}, ${Math.max(0, g)}, ${Math.max(0, b)})`
  }
}

/** Choose text colour (black or white) for readability over the cell background. */
function getTextColor(value: number): string {
  const abs = Math.abs(value)
  return abs > 0.5 ? '#ffffff' : 'var(--text-primary)'
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 20,
    boxShadow: 'var(--shadow)',
    overflowX: 'auto',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  tableWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 0,
  },
  cornerCell: {
    flexShrink: 0,
  },
  headerCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  dataRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  rowLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--bg-secondary)',
    transition: 'opacity 0.15s',
  },
  cellValue: {
    fontWeight: 600,
    userSelect: 'none' as const,
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  legendLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  legendGradient: {
    width: 80,
    height: 12,
    borderRadius: 4,
    background: 'linear-gradient(to right, #f44336, #ffffff)',
  },
  legendGradient2: {
    width: 80,
    height: 12,
    borderRadius: 4,
    background: 'linear-gradient(to right, #ffffff, #4caf50)',
  },
}
