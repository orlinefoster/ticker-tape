import { useEffect, useState } from 'react'
import { commands } from '@/lib/tauri'
import { CycleIndicator } from './CycleIndicator'
import { RatiosPanel } from './RatiosPanel'

export interface IntermarketReport {
  date: string
  phase: string
  confidence: number
  indicators: IndicatorResult[]
  key_ratios: KeyRatios
  narrative: string
}

export interface IndicatorResult {
  name: string
  value: number
  signal: 'bullish' | 'bearish' | 'neutral'
  weight: number
  description: string
}

export interface KeyRatios {
  stock_bond: number
  stock_bond_trend: string
  cyclical_defensive: number
  cyclical_defensive_trend: string
  commodity_bond: number
  commodity_bond_trend: string
  dollar_ratio: number
  dollar_trend: string
}

const PHASE_EMOJIS: Record<string, string> = {
  EarlyExpansion: '🌱',
  LateExpansion: '🌊',
  Peak: '⛰️',
  Contraction: '📉',
  Trough: '🪨',
}

export default function IntermarketModule() {
  const [report, setReport] = useState<IntermarketReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await commands.runAnalysis('intermarket', [], {})
      setReport(result as unknown as IntermarketReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ejecutar análisis')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Análisis Intermarket</h1>
        <p style={styles.subtitle}>
          Determinación de la fase del ciclo económico mediante relaciones entre activos
        </p>
      </div>

      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Analizando mercado...</span>
        </div>
      )}

      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <strong>Error al analizar</strong>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
          <button onClick={fetchAnalysis} style={styles.retryBtn}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && !report && (
        <div style={styles.empty}>
          <p>No hay datos disponibles. Asegurate de tener datos de mercado cargados.</p>
          <button onClick={fetchAnalysis} style={styles.retryBtn}>
            Cargar análisis
          </button>
        </div>
      )}

      {report && (
        <div style={styles.content}>
          {/* Fase del ciclo */}
          <CycleIndicator
            phase={report.phase}
            label={translatePhase(report.phase)}
            emoji={PHASE_EMOJIS[report.phase] || '❓'}
            confidence={report.confidence}
          />

          {/* Ratios clave */}
          <RatiosPanel ratios={report.key_ratios} />

          {/* Indicadores detalle */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Señales por Indicador</h3>
            <div style={styles.indicatorsGrid}>
              {report.indicators.map((ind, i) => (
                <div key={i} style={styles.indicatorItem}>
                  <div style={styles.indicatorHeader}>
                    <span style={styles.indicatorName}>{ind.name}</span>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: ind.signal === 'bullish' ? '#e8f5e9' : ind.signal === 'bearish' ? '#ffebee' : '#fff3e0',
                      color: ind.signal === 'bullish' ? '#2e7d32' : ind.signal === 'bearish' ? '#c62828' : '#e65100',
                    }}>
                      {ind.signal === 'bullish' ? '✅ Alcista' : ind.signal === 'bearish' ? '❌ Bajista' : '⚪ Neutral'}
                    </span>
                  </div>
                  <p style={styles.indicatorDesc}>{ind.description}</p>
                  <div style={styles.weightBar}>
                    <div style={{
                      ...styles.weightFill,
                      width: `${ind.weight * 100}%`,
                      backgroundColor: ind.signal === 'bullish' ? '#4caf50' : ind.signal === 'bearish' ? '#f44336' : '#ff9800',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Narrativa */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📝 Resumen</h3>
            <p style={styles.narrative}>{report.narrative}</p>
          </div>

          <button onClick={fetchAnalysis} style={styles.refreshBtn}>
            🔄 Actualizar análisis
          </button>
        </div>
      )}
    </div>
  )
}

function translatePhase(phase: string): string {
  const map: Record<string, string> = {
    EarlyExpansion: 'Expansión Temprana',
    LateExpansion: 'Expansión Tardía',
    Peak: 'Pico de Ciclo',
    Contraction: 'Contracción',
    Trough: 'Fondo de Ciclo',
  }
  return map[phase] || phase
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
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 20,
    boxShadow: 'var(--shadow)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
  },
  indicatorsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  indicatorItem: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    padding: 12,
  },
  indicatorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  indicatorName: {
    fontWeight: 600,
  },
  badge: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 12,
    fontWeight: 500,
  },
  indicatorDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: '0 0 8px',
  },
  weightBar: {
    height: 4,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  weightFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  narrative: {
    lineHeight: 1.7,
    fontSize: 15,
    whiteSpace: 'pre-wrap',
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
  },
}
