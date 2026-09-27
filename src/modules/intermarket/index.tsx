import { useEffect, useState } from 'react'
import { commands } from '@/lib/tauri'
import { useServiceStatusStore } from '@/store/serviceStatusStore'
import { MurphyClock, type LeadingLaggingStatus, type StageScore } from './MurphyClock'
import { NormalizedMultiAssetChart, type NormalizedAssetSeries } from './NormalizedMultiAssetChart'
import { TacticalAllocationRadar, type TacticalAssetAllocation } from './TacticalAllocationRadar'
import { RatiosPanel, type MacroRatioItem } from './RatiosPanel'
import { IntermarketCorrelationMatrix, type IntermarketCorrelation } from './IntermarketCorrelationMatrix'

export interface IntermarketReport {
  date: string
  phase: string
  stage: number
  stage_name: string
  stage_description: string
  confidence: number
  stage_scores: StageScore[]
  leaders: LeadingLaggingStatus
  tactical_allocation: TacticalAssetAllocation[]
  indicators: IndicatorResult[]
  key_ratios: KeyRatios
  macro_ratios: MacroRatioItem[]
  normalized_series: NormalizedAssetSeries[]
  correlation_matrix: IntermarketCorrelation
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
  copper_gold?: number
  copper_gold_trend?: string
  credit_spread?: number
  credit_spread_trend?: string
  crypto_gold?: number
  crypto_gold_trend?: string
}

export default function IntermarketModule() {
  const { override } = useServiceStatusStore()
  const [report, setReport] = useState<IntermarketReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncingMacro, setSyncingMacro] = useState(false)

  const MACRO_BASKET = ['SPY', 'TLT', 'GLD', 'DBC', 'HYG', 'UUP', 'XLF', 'XLK', 'XLE', 'BTC']

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await commands.runAnalysis<IntermarketReport>('intermarket', [], {})
      setReport(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ejecutar análisis intermarket')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadMacroBasket = async () => {
    setSyncingMacro(true)
    setError(null)
    try {
      await commands.resyncMarketData(MACRO_BASKET, '2y')
      await fetchAnalysis()
    } catch (e) {
      setError(`Error al descargar canasta macro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncingMacro(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [])

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={styles.badgeTop}>MÓDULO MACRO & ROTACIÓN DE CAPITAL</div>
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
                🟢 MODO REAL (LIVE DATA)
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
                ⚠️ SIMULACIÓN (PAPER DATA)
              </span>
            )}
          </div>
          <h1 style={styles.title}>Ciclo Intermarket de John Murphy</h1>
          <p style={styles.subtitle}>
            Determinación de fase cíclica, reloj de 6 etapas, rotación entre Bonos, Acciones y Commodities, y Alocación Táctica de Cartera
          </p>
        </div>
        <div style={styles.headerRight}>
          {report && (
            <div style={styles.dateTag}>
              📅 Actualizado: <strong>{report.date}</strong>
            </div>
          )}
          <button
            onClick={handleDownloadMacroBasket}
            disabled={syncingMacro || loading}
            style={{
              ...styles.refreshBtnTop,
              backgroundColor: 'var(--bg-surface-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Descargar o actualizar canasta macro desde Yahoo Finance / Binance"
          >
            {syncingMacro ? '⏳ Descargando macro...' : '📥 Descargar Canasta Macro'}
          </button>
          <button
            onClick={fetchAnalysis}
            disabled={loading || syncingMacro}
            style={styles.refreshBtnTop}
          >
            {loading ? '⏳ Analizando...' : '🔄 Actualizar Análisis'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !report && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Sincronizando series de activos y evaluando el ciclo intermarket...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong>Error al analizar el ciclo intermarket</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>{error}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownloadMacroBasket}
              disabled={syncingMacro}
              style={{
                ...styles.retryBtn,
                backgroundColor: 'var(--accent)',
                color: '#fff',
                borderColor: 'var(--accent)',
              }}
            >
              {syncingMacro ? '⏳ Descargando...' : '📥 Descargar activos requeridos (SPY, TLT, GLD...)'}
            </button>
            <button onClick={fetchAnalysis} style={styles.retryBtn}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !report && (
        <div style={styles.empty}>
          <p>No hay suficientes activos macro cargados en la base de datos local SQLite.</p>
          <button
            onClick={handleDownloadMacroBasket}
            disabled={syncingMacro}
            style={{
              ...styles.retryBtn,
              backgroundColor: 'var(--accent)',
              color: '#fff',
              borderColor: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {syncingMacro ? '⏳ Descargando canasta...' : '📥 Descargar Canasta Intermarket Oficial'}
          </button>
        </div>
      )}

      {/* Main Content Dashboard */}
      {report && (
        <div style={styles.content}>
          {/* 1. John Murphy 6-Stage Clock */}
          <MurphyClock
            currentStage={report.stage || 2}
            stageName={report.stage_name}
            stageDescription={report.stage_description}
            confidence={report.confidence}
            stageScores={report.stage_scores || []}
            leaders={report.leaders}
          />

          {/* 2. Tactical Asset Allocation (TAA) Radar */}
          <TacticalAllocationRadar
            allocations={report.tactical_allocation || []}
            currentStage={report.stage || 2}
          />

          {/* 3. Normalized Multi-Asset Performance (%) Curves */}
          <NormalizedMultiAssetChart
            series={report.normalized_series || []}
          />

          {/* 4. Macro Ratios Grid & Interactive Chart Drawer */}
          <RatiosPanel
            ratios={report.key_ratios}
            macroRatios={report.macro_ratios || []}
          />

          {/* 5. Intermarket Correlation Heatmap Matrix */}
          <IntermarketCorrelationMatrix
            data={report.correlation_matrix}
          />

          {/* 6. Quantitative Indicators Grid & Model Narrative */}
          <div style={styles.bottomSplit}>
            {/* Indicators breakdown */}
            <div style={styles.cardHalf}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.cardTitle}>🔬 Confirmación por Indicador Macro</h3>
                <span style={styles.countBadge}>{report.indicators.length} Indicadores</span>
              </div>
              <div style={styles.indicatorsGrid}>
                {report.indicators.map((ind, i) => (
                  <div key={i} style={styles.indicatorItem}>
                    <div style={styles.indicatorHeader}>
                      <span style={styles.indicatorName}>{ind.name}</span>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: ind.signal === 'bullish' ? 'rgba(16, 185, 129, 0.15)' : ind.signal === 'bearish' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: ind.signal === 'bullish' ? '#34D399' : ind.signal === 'bearish' ? '#F87171' : '#FBBF24',
                        borderColor: ind.signal === 'bullish' ? 'rgba(16, 185, 129, 0.3)' : ind.signal === 'bearish' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                      }}>
                        {ind.signal === 'bullish' ? '🟢 Alcista' : ind.signal === 'bearish' ? '🔴 Bajista' : '🟡 Neutral'}
                      </span>
                    </div>
                    <p style={styles.indicatorDesc}>{ind.description}</p>
                    <div style={styles.weightBar}>
                      <div style={{
                        ...styles.weightFill,
                        width: `${ind.weight * 100}%`,
                        backgroundColor: ind.signal === 'bullish' ? '#10B981' : ind.signal === 'bearish' ? '#EF4444' : '#F59E0B',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model narrative */}
            <div style={styles.cardHalf}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.cardTitle}>📝 Diagnóstico & Síntesis Cuantitativa</h3>
                <span style={styles.modelTag}>IA Quant Engine</span>
              </div>
              <div style={styles.narrativeBox}>
                <p style={styles.narrative}>{report.narrative}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px 32px',
    maxWidth: 1200,
    margin: '0 auto',
    color: '#E2E8F0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
    minWidth: 300,
  },
  badgeTop: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--accent, #3B82F6)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
    color: '#F8FAFC',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: '#94A3B8',
    margin: '6px 0 0',
    fontSize: 13,
    lineHeight: 1.5,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dateTag: {
    fontSize: 12,
    color: '#94A3B8',
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  refreshBtnTop: {
    padding: '8px 16px',
    backgroundColor: 'var(--accent, #3B82F6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    transition: 'all 0.15s ease',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 48,
    justifyContent: 'center',
    color: '#94A3B8',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--accent, #3B82F6)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    color: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    marginBottom: 20,
  },
  retryBtn: {
    marginLeft: 'auto',
    padding: '6px 14px',
    border: '1px solid #EF4444',
    borderRadius: 6,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#EF4444',
    fontWeight: 600,
  },
  empty: {
    textAlign: 'center',
    padding: 60,
    color: '#94A3B8',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  bottomSplit: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: 20,
  },
  cardHalf: {
    backgroundColor: 'var(--bg-surface-card, #151926)',
    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: '#F8FAFC',
  },
  countBadge: {
    fontSize: 11,
    padding: '2px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    color: '#94A3B8',
  },
  modelTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#93C5FD',
    borderRadius: 4,
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  indicatorsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  indicatorItem: {
    backgroundColor: '#11141D',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  indicatorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  indicatorName: {
    fontWeight: 600,
    fontSize: 13,
    color: '#F8FAFC',
  },
  badge: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 12,
    fontWeight: 600,
    border: '1px solid',
  },
  indicatorDesc: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '0 0 8px',
    lineHeight: 1.4,
  },
  weightBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  weightFill: {
    height: '100%',
    borderRadius: 2,
  },
  narrativeBox: {
    backgroundColor: '#11141D',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    height: 'calc(100% - 40px)',
  },
  narrative: {
    lineHeight: 1.7,
    fontSize: 13.5,
    whiteSpace: 'pre-wrap',
    color: '#CBD5E1',
    margin: 0,
  },
}
