import { useState, useEffect } from 'react'
import { invoke } from '@/lib/tauri'

interface WaveLabel {
  id?: number
  symbol: string
  timeframe: string
  wave_degree: string
  wave_label: string
  start_date: string
  end_date?: string
  price_start?: number
  price_end?: number
  confidence: number
  is_automatic: boolean
  notes?: string
}

export default function ElliottWaveModule() {
  const [symbol, setSymbol] = useState('SPY')
  const [waves, setWaves] = useState<WaveLabel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLabels()
  }, [symbol])

  async function loadLabels() {
    setLoading(true)
    setError(null)
    try {
      const labels = await invoke<WaveLabel[]>('load_wave_labels', { symbol })
      setWaves(labels)
    } catch (e) {
      // No labels yet — first time
      setWaves([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCount() {
    setLoading(true)
    setError(null)
    try {
      const labels = await invoke<WaveLabel[]>('recount_waves', { symbol })
      setWaves(labels)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const impulse = waves.filter(w => ['1','2','3','4','5'].includes(w.wave_label))
  const corrective = waves.filter(w => ['A','B','C'].includes(w.wave_label))
  const other = waves.filter(w => !['1','2','3','4','5','A','B','C'].includes(w.wave_label))

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Elliott Wave 🌊</h2>
        <div style={styles.toolbar}>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={styles.select}
          >
            <option value="SPY">SPY</option>
            <option value="QQQ">QQQ</option>
            <option value="BTC">BTC</option>
          </select>
          <button onClick={handleCount} disabled={loading} style={styles.button}>
            {loading ? 'Counting...' : 'Count Waves'}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {waves.length === 0 && !loading && (
        <div style={styles.empty}>
          No wave labels yet. Click "Count Waves" to analyse {symbol}.
        </div>
      )}

      {impulse.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Impulse Waves (1-2-3-4-5)</h3>
          <WaveTable waves={impulse} />
        </div>
      )}

      {corrective.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Corrective Waves (A-B-C)</h3>
          <WaveTable waves={corrective} />
        </div>
      )}

      {other.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Other Labels</h3>
          <WaveTable waves={other} />
        </div>
      )}
    </div>
  )
}

function WaveTable({ waves }: { waves: WaveLabel[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Label</th>
          <th style={styles.th}>Degree</th>
          <th style={styles.th}>Start</th>
          <th style={styles.th}>End</th>
          <th style={styles.th}>Price Start</th>
          <th style={styles.th}>Price End</th>
          <th style={styles.th}>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {waves.map((w, i) => (
          <tr key={i} style={styles.tr}>
            <td style={styles.td}>
              <strong>{w.wave_label}</strong>
            </td>
            <td style={styles.td}>{w.wave_degree}</td>
            <td style={styles.td}>{w.start_date}</td>
            <td style={styles.td}>{w.end_date || '—'}</td>
            <td style={styles.td}>{w.price_start?.toFixed(2) || '—'}</td>
            <td style={styles.td}>{w.price_end?.toFixed(2) || '—'}</td>
            <td style={styles.td}>
              <span style={{
                color: w.confidence > 0.7 ? '#4caf50' : w.confidence > 0.4 ? '#ff9800' : '#f44336'
              }}>
                {(w.confidence * 100).toFixed(0)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    maxWidth: 1000,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
  },
  toolbar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  select: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: 14,
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  button: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#1565c0',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    padding: 12,
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 6,
    marginBottom: 16,
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 8,
  },
  section: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: '0 0 12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '8px 12px',
  },
}
