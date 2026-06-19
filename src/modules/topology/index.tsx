import { useEffect, useState, useCallback } from 'react'
import { commands } from '@/lib/tauri'
import { RankingsTable } from './RankingsTable'
import type { AssetRanking } from './RankingsTable'
import { CorrelationHeatmap } from './CorrelationHeatmap'
import { RegimeIndicator } from './RegimeIndicator'

interface CorrelationMatrix {
  symbols: string[]
  correlations: number[][]
}

interface RegimeInfo {
  regime: string
  description: string
  affected_symbols: string[]
}

interface TopologyReport {
  date: string
  universe_size: number
  rankings: AssetRanking[]
  correlations: CorrelationMatrix
  regimes: RegimeInfo[]
}

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'TLT', 'GLD', 'DBC', 'BTC']

export default function TopologyModule() {
  const [report, setReport] = useState<TopologyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [symbolInput, setSymbolInput] = useState('')
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)

  const fetchAnalysis = useCallback(async (symList: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const result = await commands.runAnalysis('topology', symList, {})
      setReport(result as unknown as TopologyReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error running topology analysis')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalysis(DEFAULT_SYMBOLS)
  }, [fetchAnalysis])

  const handleAddSymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase()
    if (!trimmed) return
    if (symbols.includes(trimmed)) {
      setSymbolInput('')
      return
    }
    const newSymbols = [...symbols, trimmed]
    setSymbols(newSymbols)
    setSymbolInput('')
    fetchAnalysis(newSymbols)
  }

  const handleRemoveSymbol = (sym: string) => {
    const newSymbols = symbols.filter((s) => s !== sym)
    if (newSymbols.length === 0) return
    setSymbols(newSymbols)
    fetchAnalysis(newSymbols)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSymbol()
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📈 Market Topology</h1>
        <p style={styles.subtitle}>
          Momentum rankings, cross-asset correlations, and market regime detection
        </p>
      </div>

      {/* Symbol Input */}
      <div style={styles.symbolBar}>
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add symbol (e.g. AAPL)"
            style={styles.input}
          />
          <button onClick={handleAddSymbol} style={styles.addBtn}>
            Add
          </button>
        </div>
        <div style={styles.symbolTags}>
          {symbols.map((sym) => (
            <span key={sym} style={styles.symbolTag}>
              {sym}
              <button
                onClick={() => handleRemoveSymbol(sym)}
                style={styles.removeBtn}
                title={`Remove ${sym}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Analyzing market topology...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <strong>Analysis Error</strong>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
          <button onClick={() => fetchAnalysis(symbols)} style={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* No data */}
      {!loading && !error && !report && (
        <div style={styles.empty}>
          <p>No data available. Ensure market data is loaded for the selected symbols.</p>
          <button onClick={() => fetchAnalysis(symbols)} style={styles.retryBtn}>
            Load Analysis
          </button>
        </div>
      )}

      {/* Report */}
      {report && (
        <div style={styles.content}>
          <div style={styles.meta}>
            <span style={styles.metaItem}>
              Universe: <strong>{report.universe_size} assets</strong>
            </span>
            <span style={styles.metaItem}>
              Date: <strong>{report.date}</strong>
            </span>
          </div>

          {/* Rankings Table */}
          <RankingsTable rankings={report.rankings} />

          {/* Correlation Heatmap */}
          <CorrelationHeatmap correlations={report.correlations} />

          {/* Regime Indicator */}
          <RegimeIndicator regimes={report.regimes} />

          <button
            onClick={() => fetchAnalysis(symbols)}
            style={styles.refreshBtn}
            disabled={loading}
          >
            🔄 {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: 960,
    margin: '0 auto',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    margin: '8px 0 0',
  },
  symbolBar: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 16,
    marginBottom: 20,
    boxShadow: 'var(--shadow)',
  },
  inputGroup: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  symbolTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  symbolTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--text-secondary)',
    padding: 0,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    justifyContent: 'center',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 'var(--radius)',
    color: '#c62828',
  },
  retryBtn: {
    marginLeft: 'auto',
    padding: '8px 16px',
    border: '1px solid #c62828',
    borderRadius: 'var(--radius)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#c62828',
  },
  empty: {
    textAlign: 'center',
    padding: 48,
    color: 'var(--text-secondary)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  meta: {
    display: 'flex',
    gap: 24,
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  refreshBtn: {
    padding: '12px 24px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    alignSelf: 'center',
    opacity: 1,
    transition: 'opacity 0.2s',
  },
}
