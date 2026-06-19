import { useState, useMemo } from 'react'

export interface AssetRanking {
  symbol: string
  returns_1w: number
  returns_1m: number
  returns_3m: number
  returns_6m: number
  returns_1y: number
  percentile_rank: number
  volatility: number
  momentum_score: number
}

type SortColumn = keyof AssetRanking
type SortDir = 'asc' | 'desc'

interface Props {
  rankings: AssetRanking[]
}

const COLUMNS: { key: SortColumn; label: string; format: (v: number) => string }[] = [
  { key: 'symbol', label: 'Symbol', format: (v) => String(v) },
  { key: 'returns_1w', label: '1w', format: fmtPct },
  { key: 'returns_1m', label: '1m', format: fmtPct },
  { key: 'returns_3m', label: '3m', format: fmtPct },
  { key: 'returns_6m', label: '6m', format: fmtPct },
  { key: 'returns_1y', label: '1y', format: fmtPct },
  { key: 'percentile_rank', label: 'Pctl', format: fmtPct },
  { key: 'volatility', label: 'Vol', format: fmtPct },
  { key: 'momentum_score', label: 'Momentum', format: fmtDec },
]

const SORTABLE_KEYS = new Set<SortColumn>([
  'returns_1w', 'returns_1m', 'returns_3m', 'returns_6m', 'returns_1y',
  'percentile_rank', 'volatility', 'momentum_score',
])

/** Render a return value with green/red colour coding. */
function returnColor(value: number): string {
  if (value > 0) return '#4caf50'
  if (value < 0) return '#f44336'
  return 'var(--text-primary)'
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function fmtDec(v: number): string {
  return v.toFixed(4)
}

/**
 * Sortable rankings table with colour coding.
 *
 * Highlights the top 3 and bottom 3 rows by momentum score.
 */
export function RankingsTable({ rankings }: Props) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('momentum_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const sorted = [...rankings]
    sorted.sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = aVal as number
      const bNum = bVal as number
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return sorted
  }, [rankings, sortColumn, sortDir])

  const top3 = useMemo(() => {
    if (rankings.length <= 3) return new Set(rankings.map((r) => r.symbol))
    const sortedByMomentum = [...rankings].sort(
      (a, b) => b.momentum_score - a.momentum_score
    )
    const top = new Set(sortedByMomentum.slice(0, 3).map((r) => r.symbol))
    return top
  }, [rankings])

  const bottom3 = useMemo(() => {
    if (rankings.length <= 3) return new Set<string>()
    const sortedByMomentum = [...rankings].sort(
      (a, b) => a.momentum_score - b.momentum_score
    )
    const bottom = new Set(sortedByMomentum.slice(0, 3).map((r) => r.symbol))
    return bottom
  }, [rankings])

  const handleSort = (key: SortColumn) => {
    if (!SORTABLE_KEYS.has(key) && key !== 'symbol') return
    if (sortColumn === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  if (rankings.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Asset Rankings</h3>
        <p style={styles.empty}>No ranking data available.</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>
        Asset Rankings
        <span style={styles.count}>({rankings.length} assets)</span>
      </h3>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const isActive = sortColumn === col.key
                const canSort = SORTABLE_KEYS.has(col.key) || col.key === 'symbol'
                return (
                  <th
                    key={col.key}
                    style={{
                      ...styles.th,
                      cursor: canSort ? 'pointer' : 'default',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                    onClick={() => handleSort(col.key)}
                    title={canSort ? `Sort by ${col.label}` : undefined}
                  >
                    {col.label}
                    {isActive && (
                      <span style={{ marginLeft: 4 }}>
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((rank) => {
              const isTop = top3.has(rank.symbol)
              const isBottom = bottom3.has(rank.symbol)
              return (
                <tr
                  key={rank.symbol}
                  style={{
                    ...styles.tr,
                    backgroundColor: isTop ? 'rgba(76, 175, 80, 0.06)' : isBottom ? 'rgba(244, 67, 54, 0.06)' : undefined,
                  }}
                >
                  <td style={{ ...styles.td, fontWeight: 700 }}>
                    {rank.symbol}
                    {isTop && <span style={styles.badge}>▲</span>}
                    {isBottom && <span style={{ ...styles.badge, color: '#f44336' }}>▼</span>}
                  </td>
                  <td style={{ ...styles.td, color: returnColor(rank.returns_1w) }}>{fmtPct(rank.returns_1w)}</td>
                  <td style={{ ...styles.td, color: returnColor(rank.returns_1m) }}>{fmtPct(rank.returns_1m)}</td>
                  <td style={{ ...styles.td, color: returnColor(rank.returns_3m) }}>{fmtPct(rank.returns_3m)}</td>
                  <td style={{ ...styles.td, color: returnColor(rank.returns_6m) }}>{fmtPct(rank.returns_6m)}</td>
                  <td style={{ ...styles.td, color: returnColor(rank.returns_1y) }}>{fmtPct(rank.returns_1y)}</td>
                  <td style={styles.td}>{fmtPct(rank.percentile_rank / 100)}</td>
                  <td style={{ ...styles.td, color: returnColor(rank.volatility) }}>{fmtPct(rank.volatility)}</td>
                  <td style={{ ...styles.td, fontWeight: 700, color: returnColor(rank.momentum_score) }}>
                    {fmtDec(rank.momentum_score)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
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
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    fontSize: 13,
    fontWeight: 400,
    color: 'var(--text-secondary)',
  },
  empty: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 16,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '10px 8px',
    textAlign: 'right',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  tr: {
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '8px',
    textAlign: 'right',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  badge: {
    marginLeft: 4,
    fontSize: 11,
    color: '#4caf50',
    fontWeight: 700,
  },
}
