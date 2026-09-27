import React, { useEffect, useState, useCallback } from 'react'
import { commands } from '@/lib/tauri'
import { useServiceStatusStore } from '@/store/serviceStatusStore'
import { Card, Button, Badge } from '@/components/ui'
import { RankingsTable } from './RankingsTable'
import { CorrelationHeatmap } from './CorrelationHeatmap'
import { RegimeIndicator } from './RegimeIndicator'
import { TopologyKpis } from './TopologyKpis'
import { TopologyNetworkGraph } from './TopologyNetworkGraph'
import type { TopologyReport } from './types'

const PRESETS: { label: string; symbols: string[] }[] = [
  { label: 'Macro Global', symbols: ['SPY', 'QQQ', 'TLT', 'GLD', 'DBC', 'BTC'] },
  { label: 'Sectores US', symbols: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU'] },
  { label: 'Tech & Crypto', symbols: ['BTC', 'ETH', 'SOL', 'QQQ', 'NVDA', 'AAPL'] },
]

const WINDOWS: { label: string; days: number; description: string }[] = [
  { label: '21d', days: 21, description: 'Táctico / Shock reciente' },
  { label: '63d', days: 63, description: 'Swing / Trimestral estándar' },
  { label: '252d', days: 252, description: 'Estructural / Macro anual' },
]

export default function TopologyModule() {
  const { override } = useServiceStatusStore()
  const [report, setReport] = useState<TopologyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [symbolInput, setSymbolInput] = useState('')
  const [symbols, setSymbols] = useState<string[]>(PRESETS[0].symbols)
  const [windowDays, setWindowDays] = useState<number>(63)
  const [activeTab, setActiveTab] = useState<'network' | 'heatmap' | 'rankings'>('network')

  const fetchAnalysis = useCallback(async (symList: string[], windowSize: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await commands.runAnalysis<TopologyReport>('topology', symList, {
        window: windowSize,
      })
      setReport(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error running topology analysis')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDownloadCurrentSymbols = async () => {
    setSyncing(true)
    setError(null)
    try {
      await commands.resyncMarketData(symbols, '1y')
      await fetchAnalysis(symbols, windowDays)
    } catch (e) {
      setError(`Error al descargar cotizaciones para topología: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchAnalysis(symbols, windowDays)
  }, [fetchAnalysis, symbols, windowDays])

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
  }

  const handleRemoveSymbol = (sym: string) => {
    const newSymbols = symbols.filter((s) => s !== sym)
    if (newSymbols.length === 0) return
    setSymbols(newSymbols)
  }

  const handleSelectPreset = (presetSymbols: string[]) => {
    setSymbols(presetSymbols)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSymbol()
    }
  }

  return (
    <div style={styles.container}>
      {/* Module Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>📈 Market Topology</h1>
          <Badge variant="primary">Redes &amp; Clustering HRP</Badge>
          {override === 'Real' ? (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: 'var(--signal-bullish)',
              }}
            >
              🟢 MODO REAL
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: 'var(--signal-warning)',
              }}
            >
              ⚠️ SIMULACIÓN
            </span>
          )}
        </div>
        <p style={styles.subtitle}>
          Estructura geométrica del mercado: Árbol de Expansión Mínima (MST de Mantegna), Hubs de
          transmisión sistémica y quasi-diagonalización HRP para rebalanceo óptimo.
        </p>
      </div>

      {/* Universe & Parameters Control Bar */}
      <Card variant="filled" style={styles.controlCard}>
        {/* Presets Row */}
        <div style={styles.presetsRow}>
          <span style={styles.controlSectionLabel}>PRESETS RÁPIDOS:</span>
          <div style={styles.presetButtons}>
            {PRESETS.map((p) => {
              const isActive =
                symbols.length === p.symbols.length &&
                symbols.every((s, i) => s === p.symbols[i])
              return (
                <Button
                  key={p.label}
                  size="sm"
                  variant={isActive ? 'primary' : 'outline'}
                  onClick={() => handleSelectPreset(p.symbols)}
                >
                  {p.label}
                </Button>
              )
            })}
          </div>

          {/* Time Horizon Selector */}
          <div style={styles.windowSelector}>
            <span style={styles.controlSectionLabel}>HORIZONTE:</span>
            <div style={styles.windowButtonGroup}>
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  style={{
                    ...styles.windowBtn,
                    ...(windowDays === w.days ? styles.windowBtnActive : {}),
                  }}
                  onClick={() => setWindowDays(w.days)}
                  title={w.description}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Symbol Input & Tags */}
        <div style={styles.symbolInputRow}>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Agregar ticker (e.g. NVDA, ETH)..."
              style={styles.input}
            />
            <Button size="sm" onClick={handleAddSymbol} style={styles.addBtn}>
              + Agregar
            </Button>
          </div>

          <div style={styles.symbolTags}>
            {symbols.map((sym) => (
              <span key={sym} style={styles.symbolTag}>
                {sym}
                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  style={styles.removeBtn}
                  title={`Eliminar ${sym}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Calculando topología, distancias de Mantegna y grafo MST...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong>Error de análisis topológico</strong>
            <p style={{ margin: 0, fontSize: 13 }}>{error}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              variant="primary"
              onClick={handleDownloadCurrentSymbols}
              isLoading={syncing}
            >
              {syncing ? 'Descargando...' : '📥 Descargar cotizaciones reales'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchAnalysis(symbols, windowDays)}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {/* Main Analysis Dashboard */}
      {!loading && report && (
        <div style={styles.content}>
          {/* Executive Topologic KPIs */}
          <TopologyKpis
            metrics={report.metrics}
            centrality={report.centrality}
            regimes={report.regimes}
          />

          {/* Navigation Tabs */}
          <div style={styles.tabNav}>
            <button
              onClick={() => setActiveTab('network')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'network' ? styles.tabBtnActive : {}),
              }}
            >
              🌐 Red Topológica &amp; Hubs (MST)
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'heatmap' ? styles.tabBtnActive : {}),
              }}
            >
              📊 Matriz de Clústeres (HRP)
            </button>
            <button
              onClick={() => setActiveTab('rankings')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'rankings' ? styles.tabBtnActive : {}),
              }}
            >
              📈 Momentum &amp; Regímenes
            </button>
          </div>

          {/* Tab 1: Interactive Network Graph */}
          {activeTab === 'network' && (
            <TopologyNetworkGraph
              symbols={report.correlations.symbols}
              mstEdges={report.mst_edges}
              centrality={report.centrality}
              rankings={report.rankings}
              correlations={report.correlations}
            />
          )}

          {/* Tab 2: Reorderable Heatmap with HRP Clusters */}
          {activeTab === 'heatmap' && (
            <CorrelationHeatmap
              correlations={report.correlations}
              hrpOrder={report.hrp_order}
              windowDays={windowDays}
            />
          )}

          {/* Tab 3: Momentum Rankings & Regimes */}
          {activeTab === 'rankings' && (
            <div style={styles.rankingsSection}>
              <RankingsTable rankings={report.rankings} />
              <RegimeIndicator regimes={report.regimes} />
            </div>
          )}

          {/* Footer refresh status */}
          <div style={styles.footerRow}>
            <span style={styles.footerMeta}>
              Universo: <strong>{report.universe_size} activos</strong> · Fecha de corte:{' '}
              <strong>{report.date}</strong> · Ventana: <strong>{windowDays} días</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchAnalysis(symbols, windowDays)}
              disabled={loading}
            >
              🔄 Actualizar Datos
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: 1040,
    margin: '0 auto',
  },
  header: {
    marginBottom: '20px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '6px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
    margin: 0,
  },
  controlCard: {
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  presetsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  controlSectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  presetButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  windowSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: 'auto',
  },
  windowButtonGroup: {
    display: 'inline-flex',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  windowBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    border: 'none',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  windowBtnActive: {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
  },
  symbolInputRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: '12px',
  },
  inputGroup: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  input: {
    padding: '6px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '210px',
  },
  addBtn: {
    fontWeight: 600,
  },
  symbolTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    flex: 1,
  },
  symbolTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    padding: 0,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  tabNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '8px',
  },
  tabBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--accent)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
  },
  rankingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid var(--border)',
    marginTop: '12px',
  },
  footerMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '48px',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 'var(--radius)',
    color: 'var(--signal-bearish)',
    marginBottom: '20px',
  },
}
