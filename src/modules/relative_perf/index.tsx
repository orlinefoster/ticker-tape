interface RelativeStrength {
  symbol: string
  returns_1w: number
  returns_1m: number
  returns_3m: number
  returns_6m: number
  returns_1y: number
  rank_1w: number
  rank_1m: number
  rank_3m: number
  rank_6m: number
  rank_1y: number
  composite_rs: number
  vs_benchmark_1m: number
  vs_benchmark_3m: number
  vs_benchmark_6m: number
}

const WINDOWS = ['1w', '1m', '3m', '6m', '1y'] as const

function rankColor(rank: number, total: number): string {
  const pct = rank / total
  if (pct <= 0.25) return '#4caf50'
  if (pct <= 0.5) return '#8bc34a'
  if (pct <= 0.75) return '#ff9800'
  return '#f44336'
}

function vsColor(vs: number): string {
  if (vs > 0.02) return '#4caf50'
  if (vs > 0) return '#8bc34a'
  if (vs > -0.02) return '#ff9800'
  return '#f44336'
}

// Placeholder data matching the backend ranking output
const PLACEHOLDER_DATA: RelativeStrength[] = [
  { symbol: 'QQQ', returns_1w: 0.012, returns_1m: 0.045, returns_3m: 0.089, returns_6m: 0.156, returns_1y: 0.283, rank_1w: 1, rank_1m: 1, rank_3m: 1, rank_6m: 2, rank_1y: 1, composite_rs: 92.3, vs_benchmark_1m: 0.008, vs_benchmark_3m: 0.012, vs_benchmark_6m: 0.021 },
  { symbol: 'SPY', returns_1w: 0.008, returns_1m: 0.037, returns_3m: 0.077, returns_6m: 0.135, returns_1y: 0.262, rank_1w: 2, rank_1m: 2, rank_3m: 2, rank_6m: 1, rank_1y: 2, composite_rs: 75.0, vs_benchmark_1m: 0.000, vs_benchmark_3m: 0.000, vs_benchmark_6m: 0.000 },
  { symbol: 'GLD', returns_1w: -0.003, returns_1m: 0.012, returns_3m: 0.045, returns_6m: 0.089, returns_1y: 0.156, rank_1w: 3, rank_1m: 3, rank_3m: 3, rank_6m: 3, rank_1y: 3, composite_rs: 35.4, vs_benchmark_1m: -0.025, vs_benchmark_3m: -0.032, vs_benchmark_6m: -0.046 },
  { symbol: 'TLT', returns_1w: -0.008, returns_1m: -0.005, returns_3m: 0.012, returns_6m: 0.034, returns_1y: 0.067, rank_1w: 4, rank_1m: 4, rank_3m: 4, rank_6m: 4, rank_1y: 4, composite_rs: 15.2, vs_benchmark_1m: -0.042, vs_benchmark_3m: -0.065, vs_benchmark_6m: -0.101 },
  { symbol: 'DBC', returns_1w: -0.015, returns_1m: -0.028, returns_3m: -0.008, returns_6m: 0.012, returns_1y: -0.034, rank_1w: 5, rank_1m: 5, rank_3m: 5, rank_6m: 5, rank_1y: 5, composite_rs: 5.1, vs_benchmark_1m: -0.065, vs_benchmark_3m: -0.085, vs_benchmark_6m: -0.147 },
]

export default function RelativePerfModule() {
  const data = PLACEHOLDER_DATA
  const total = data.length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Relative Performance 📊</h2>
        <span style={styles.badge}>Benchmark: SPY</span>
      </div>

      {/* RS Leaderboard */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Relative Strength Rankings</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Symbol</th>
                  {WINDOWS.map(w => (
                    <th key={w} style={styles.th}>{w} Ret</th>
                  ))}
                  {WINDOWS.map(w => (
                    <th key={`r-${w}`} style={styles.th}>{w} Rank</th>
                  ))}
                  <th style={styles.th}>RS Score</th>
                  <th style={styles.th}>vs Bench 1m</th>
                  <th style={styles.th}>vs Bench 3m</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.symbol} style={styles.tr}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{r.symbol}</td>
                    <td style={styles.td}>{(r.returns_1w * 100).toFixed(1)}%</td>
                    <td style={styles.td}>{(r.returns_1m * 100).toFixed(1)}%</td>
                    <td style={styles.td}>{(r.returns_3m * 100).toFixed(1)}%</td>
                    <td style={styles.td}>{(r.returns_6m * 100).toFixed(1)}%</td>
                    <td style={styles.td}>{(r.returns_1y * 100).toFixed(1)}%</td>
                    <td style={{
                      ...styles.td,
                      color: rankColor(r.rank_1w, total),
                      fontWeight: 600,
                    }}>{r.rank_1w}/{total}</td>
                    <td style={{
                      ...styles.td,
                      color: rankColor(r.rank_1m, total),
                      fontWeight: 600,
                    }}>{r.rank_1m}/{total}</td>
                    <td style={{
                      ...styles.td,
                      color: rankColor(r.rank_3m, total),
                      fontWeight: 600,
                    }}>{r.rank_3m}/{total}</td>
                    <td style={{
                      ...styles.td,
                      color: rankColor(r.rank_6m, total),
                      fontWeight: 600,
                    }}>{r.rank_6m}/{total}</td>
                    <td style={{
                      ...styles.td,
                      color: rankColor(r.rank_1y, total),
                      fontWeight: 600,
                    }}>{r.rank_1y}/{total}</td>
                    <td style={{
                      ...styles.td,
                      fontWeight: 700,
                      color: r.composite_rs > 80 ? '#4caf50' : r.composite_rs > 50 ? '#ff9800' : '#f44336',
                    }}>
                      {r.composite_rs.toFixed(0)}
                    </td>
                    <td style={{
                      ...styles.td,
                      color: vsColor(r.vs_benchmark_1m),
                    }}>
                      {(r.vs_benchmark_1m * 100).toFixed(1)}%
                    </td>
                    <td style={{
                      ...styles.td,
                      color: vsColor(r.vs_benchmark_3m),
                    }}>
                      {(r.vs_benchmark_3m * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Summary</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard
                label="Top Performer"
                value={data[0]?.symbol ?? '—'}
                color="#4caf50"
              />
              <SummaryCard
                label="Bottom Performer"
                value={data[data.length - 1]?.symbol ?? '—'}
                color="#f44336"
              />
              <SummaryCard
                label="RS Score Range"
                value={`${data[data.length - 1]?.composite_rs.toFixed(0) ?? '—'} – ${data[0]?.composite_rs.toFixed(0) ?? '—'}`}
                color="var(--text-primary)"
              />
            </div>
          </div>
        </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.card}>
      <span style={styles.cardLabel}>{label}</span>
      <span style={{ ...styles.cardValue, color }}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, flexWrap: 'wrap', gap: 12,
  },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  badge: {
    padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
    backgroundColor: '#e3f2fd', color: '#1565c0',
  },
  empty: {
    padding: 32, textAlign: 'center', color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)', borderRadius: 8,
  },
  section: {
    backgroundColor: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 12px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 8px', borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '6px 8px', whiteSpace: 'nowrap' },
  summaryGrid: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  card: {
    flex: 1, minWidth: 150, padding: 16, backgroundColor: 'var(--bg-primary)',
    borderRadius: 8, textAlign: 'center',
  },
  cardLabel: {
    display: 'block', fontSize: 12, color: 'var(--text-secondary)',
    textTransform: 'uppercase', fontWeight: 600, marginBottom: 4,
  },
  cardValue: { display: 'block', fontSize: 20, fontWeight: 700 },
}
