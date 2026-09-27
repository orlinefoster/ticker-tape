import React, { useMemo, useState } from 'react'

export interface NormalizedPoint {
  date: string
  value: number // % change
}

export interface NormalizedAssetSeries {
  symbol: string
  name: string
  color: string
  current_pct: number
  points: NormalizedPoint[]
}

interface NormalizedChartProps {
  series: NormalizedAssetSeries[]
}

type Timeframe = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export const NormalizedMultiAssetChart: React.FC<NormalizedChartProps> = ({ series }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set())

  const toggleSymbol = (sym: string) => {
    setHiddenSymbols(prev => {
      const next = new Set(prev)
      if (next.has(sym)) {
        next.delete(sym)
      } else {
        next.add(sym)
      }
      return next
    })
  }

  // Filter series points by timeframe and normalize to 0% at the start of that timeframe
  const filteredSeries = useMemo(() => {
    if (!series || series.length === 0) return []

    // Find maximum point count
    const maxLen = Math.max(...series.map(s => s.points.length))
    let sliceDays = maxLen

    if (timeframe === '1M') sliceDays = 22
    else if (timeframe === '3M') sliceDays = 66
    else if (timeframe === '6M') sliceDays = 132
    else if (timeframe === '1Y') sliceDays = 252

    return series.map(s => {
      const rawPoints = s.points.slice(-sliceDays)
      if (rawPoints.length === 0) return { ...s, points: [] }

      // Base value is the first value in this timeframe
      const baseVal = rawPoints[0].value

      const rebasedPoints = rawPoints.map(p => ({
        date: p.date,
        // Re-scale so first point is exactly 0.00%
        value: Math.round((p.value - baseVal) * 100) / 100,
      }))

      return {
        ...s,
        current_pct: rebasedPoints[rebasedPoints.length - 1]?.value ?? 0,
        points: rebasedPoints,
      }
    })
  }, [series, timeframe])

  const visibleSeries = useMemo(() => {
    return filteredSeries.filter(s => !hiddenSymbols.has(s.symbol))
  }, [filteredSeries, hiddenSymbols])

  // Get common date axis
  const dates = useMemo(() => {
    if (visibleSeries.length === 0) return []
    // Take dates from the series with the most points
    let longest: NormalizedPoint[] = []
    for (const s of visibleSeries) {
      if (s.points.length > longest.length) longest = s.points
    }
    return longest.map(p => p.date)
  }, [visibleSeries])

  // Compute Min and Max % across all visible series
  const { minVal, maxVal } = useMemo(() => {
    let min = -5
    let max = 5
    for (const s of visibleSeries) {
      for (const p of s.points) {
        if (p.value < min) min = p.value
        if (p.value > max) max = p.value
      }
    }
    const pad = Math.max(Math.abs(max - min) * 0.1, 2)
    return { minVal: min - pad, maxVal: max + pad }
  }, [visibleSeries])

  // Chart dimensions
  const width = 880
  const height = 320
  const padLeft = 55
  const padRight = 30
  const padTop = 20
  const padBottom = 35

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const getY = (val: number) => {
    if (maxVal === minVal) return padTop + chartH / 2
    return padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH
  }

  const getX = (idx: number, total: number) => {
    if (total <= 1) return padLeft
    return padLeft + (idx / (total - 1)) * chartW
  }

  // Handle mouse hovering for crosshair without wheel hijacking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * width

    if (svgX < padLeft || svgX > padLeft + chartW || dates.length <= 1) {
      setHoverIndex(null)
      return
    }

    const relX = (svgX - padLeft) / chartW
    const idx = Math.round(relX * (dates.length - 1))
    setHoverIndex(Math.max(0, Math.min(dates.length - 1, idx)))
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  // Y-axis tick values (4-5 nice round numbers)
  const yTicks = useMemo(() => {
    const range = maxVal - minVal
    const step = range > 40 ? 10 : range > 20 ? 5 : range > 10 ? 2 : 1
    const ticks: number[] = []
    const start = Math.ceil(minVal / step) * step
    for (let t = start; t <= maxVal; t += step) {
      ticks.push(t)
    }
    if (!ticks.includes(0) && minVal <= 0 && maxVal >= 0) {
      ticks.push(0)
      ticks.sort((a, b) => a - b)
    }
    return ticks
  }, [minVal, maxVal])

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.tag}>RENDIMIENTO RELATIVO MULTIACTIVO</div>
          <h3 style={styles.title}>Curvas de Retorno Normalizado (%)</h3>
          <p style={styles.subtitle}>
            Comparativa directa de momentum acumulado entre acciones, bonos soberanos, materias primas, oro y cripto
          </p>
        </div>

        {/* Timeframe selector buttons */}
        <div style={styles.tfButtons}>
          {(['1M', '3M', '6M', '1Y', 'ALL'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                ...styles.tfBtn,
                backgroundColor: timeframe === tf ? 'var(--accent, #3B82F6)' : 'rgba(255, 255, 255, 0.05)',
                color: timeframe === tf ? '#FFFFFF' : '#94A3B8',
                borderColor: timeframe === tf ? 'var(--accent, #3B82F6)' : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Asset toggles legend */}
      <div style={styles.legendRow}>
        {filteredSeries.map(s => {
          const isHidden = hiddenSymbols.has(s.symbol)
          return (
            <button
              key={s.symbol}
              onClick={() => toggleSymbol(s.symbol)}
              style={{
                ...styles.legendItem,
                opacity: isHidden ? 0.35 : 1,
                borderColor: isHidden ? 'rgba(255,255,255,0.06)' : s.color + '50',
                backgroundColor: isHidden ? 'transparent' : 'rgba(255,255,255,0.03)',
              }}
            >
              <span style={{ ...styles.legendDot, backgroundColor: s.color }} />
              <span style={styles.legendSymbol}>{s.symbol}</span>
              <span style={{
                ...styles.legendPct,
                color: s.current_pct >= 0 ? '#10B981' : '#EF4444',
              }}>
                {s.current_pct >= 0 ? '+' : ''}{s.current_pct.toFixed(1)}%
              </span>
            </button>
          )
        })}
      </div>

      {/* Interactive SVG Chart */}
      <div style={styles.chartContainer}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={styles.svg}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Grid lines & Y Ticks */}
          {yTicks.map(t => {
            const y = getY(t)
            const isZero = t === 0
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + chartW}
                  y2={y}
                  stroke={isZero ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)'}
                  strokeWidth={isZero ? 1.5 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  fill={isZero ? '#F8FAFC' : '#64748B'}
                  fontSize={10}
                  fontWeight={isZero ? 700 : 400}
                  textAnchor="end"
                >
                  {t >= 0 ? `+${t}%` : `${t}%`}
                </text>
              </g>
            )
          })}

          {/* X Axis Dates (sample 5 dates) */}
          {dates.length > 0 && [0, Math.floor(dates.length * 0.25), Math.floor(dates.length * 0.5), Math.floor(dates.length * 0.75), dates.length - 1].map(idx => {
            const x = getX(idx, dates.length)
            return (
              <text
                key={idx}
                x={x}
                y={padTop + chartH + 18}
                fill="#64748B"
                fontSize={10}
                textAnchor="middle"
              >
                {dates[idx]}
              </text>
            )
          })}

          {/* Asset Curves */}
          {visibleSeries.map(s => {
            if (s.points.length <= 1) return null

            const dPath = s.points.map((p, i) => {
              const x = getX(i, s.points.length)
              const y = getY(p.value)
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
            }).join(' ')

            return (
              <g key={s.symbol}>
                <path
                  d={dPath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoverIndex !== null ? 0.85 : 0.95}
                />
              </g>
            )
          })}

          {/* Hover Crosshair and Tooltip */}
          {hoverIndex !== null && dates[hoverIndex] && (
            <g>
              {/* Vertical line */}
              <line
                x1={getX(hoverIndex, dates.length)}
                y1={padTop}
                x2={getX(hoverIndex, dates.length)}
                y2={padTop + chartH}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />

              {/* Data points at hover */}
              {visibleSeries.map(s => {
                const pt = s.points[hoverIndex]
                if (!pt) return null
                const x = getX(hoverIndex, dates.length)
                const y = getY(pt.value)
                return (
                  <circle
                    key={s.symbol}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={s.color}
                    stroke="#11141D"
                    strokeWidth={2}
                  />
                )
              })}
            </g>
          )}
        </svg>

        {/* Hover Floating Card */}
        {hoverIndex !== null && dates[hoverIndex] && (
          <div style={{
            ...styles.hoverCard,
            left: Math.min(Math.max(getX(hoverIndex, dates.length) - 60, 10), width - 180),
          }}>
            <div style={styles.hoverDate}>📅 {dates[hoverIndex]}</div>
            <div style={styles.hoverList}>
              {visibleSeries.map(s => {
                const pt = s.points[hoverIndex]
                const val = pt ? pt.value : 0
                return (
                  <div key={s.symbol} style={styles.hoverItem}>
                    <span style={{ color: s.color, fontWeight: 700 }}>{s.symbol}:</span>
                    <span style={{ color: val >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                      {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
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
  tfButtons: {
    display: 'flex',
    gap: 6,
    backgroundColor: '#11141D',
    padding: 4,
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  tfBtn: {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  legendRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 12,
    transition: 'opacity 0.2s',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  legendSymbol: {
    color: '#F8FAFC',
    fontWeight: 600,
  },
  legendPct: {
    fontWeight: 700,
    fontSize: 11,
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#0F131D',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  hoverCard: {
    position: 'absolute',
    top: 12,
    backgroundColor: 'rgba(17, 20, 29, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    padding: '8px 12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    zIndex: 10,
    minWidth: 140,
  },
  hoverDate: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94A3B8',
    marginBottom: 6,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: 4,
  },
  hoverList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  hoverItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    gap: 8,
  },
}
