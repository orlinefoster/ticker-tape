import React from 'react'

export interface TacticalAssetAllocation {
  asset_class: string
  stance: string       // "overweight" | "neutral" | "underweight"
  stance_label: string // "Sobreponderar" | "Neutral" | "Subponderar"
  weight_delta_pct: number
  rationale: string
  top_picks: string[]
  avoid: string[]
}

interface TacticalRadarProps {
  allocations: TacticalAssetAllocation[]
  currentStage: number
}

export const TacticalAllocationRadar: React.FC<TacticalRadarProps> = ({
  allocations,
  currentStage,
}) => {
  if (!allocations || allocations.length === 0) return null

  const getStanceStyle = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'overweight':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          text: '#10B981',
          border: 'rgba(16, 185, 129, 0.3)',
          icon: '🟢',
        }
      case 'underweight':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          text: '#EF4444',
          border: 'rgba(239, 68, 68, 0.3)',
          icon: '🔴',
        }
      default:
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          text: '#F59E0B',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: '🟡',
        }
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.tag}>ESTRATEGIA MACRO CUANTITATIVA</div>
          <h3 style={styles.title}>Matriz de Alocación Táctica de Cartera (TAA)</h3>
          <p style={styles.subtitle}>
            Sesgos de sobreponderación y subponderación recomendados según la <strong>Etapa {currentStage} de John Murphy</strong>
          </p>
        </div>
        <div style={styles.stageIndicator}>
          <span>Reglas de Asignación Táctica</span>
        </div>
      </div>

      <div style={styles.grid}>
        {allocations.map((item, idx) => {
          const style = getStanceStyle(item.stance)
          const isPositive = item.weight_delta_pct > 0
          const isZero = item.weight_delta_pct === 0

          return (
            <div key={idx} style={{ ...styles.allocationCard, borderColor: style.border }}>
              <div style={styles.cardHeader}>
                <div style={styles.assetName}>{item.asset_class}</div>
                <div style={{ ...styles.stanceBadge, backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
                  <span>{style.icon}</span>
                  <span>{item.stance_label}</span>
                </div>
              </div>

              {/* Allocation tilt gauge */}
              <div style={styles.gaugeContainer}>
                <div style={styles.gaugeMeta}>
                  <span style={styles.gaugeLabel}>Inclinación Sugerida:</span>
                  <span style={{
                    ...styles.gaugeVal,
                    color: isPositive ? '#10B981' : isZero ? '#94A3B8' : '#EF4444',
                  }}>
                    {isPositive ? `+${item.weight_delta_pct}%` : `${item.weight_delta_pct}%`}
                  </span>
                </div>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${Math.min(Math.abs(item.weight_delta_pct) * 3, 100)}%`,
                      backgroundColor: isPositive ? '#10B981' : isZero ? '#64748B' : '#EF4444',
                      marginLeft: item.weight_delta_pct < 0 ? 'auto' : 0,
                    }}
                  />
                </div>
              </div>

              {/* Rationale explanation */}
              <p style={styles.rationale}>{item.rationale}</p>

              {/* Top picks & avoids */}
              <div style={styles.chipsSection}>
                {item.top_picks && item.top_picks.length > 0 && (
                  <div style={styles.picksRow}>
                    <span style={styles.picksLabel}>Top Picks:</span>
                    <div style={styles.chipsList}>
                      {item.top_picks.map((pick, pIdx) => (
                        <span key={pIdx} style={styles.pickChip}>{pick}</span>
                      ))}
                    </div>
                  </div>
                )}

                {item.avoid && item.avoid.length > 0 && (
                  <div style={styles.picksRow}>
                    <span style={styles.avoidLabel}>Reducir / Evitar:</span>
                    <div style={styles.chipsList}>
                      {item.avoid.map((av, aIdx) => (
                        <span key={aIdx} style={styles.avoidChip}>{av}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
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
    marginBottom: 20,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: 16,
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
  stageIndicator: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#93C5FD',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  allocationCard: {
    backgroundColor: '#11141D',
    border: '1px solid',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  assetName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#F8FAFC',
  },
  stanceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 12,
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
  gaugeContainer: {
    marginBottom: 12,
  },
  gaugeMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    marginBottom: 4,
  },
  gaugeLabel: {
    color: '#94A3B8',
  },
  gaugeVal: {
    fontWeight: 700,
  },
  barTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    display: 'flex',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  rationale: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#CBD5E1',
    margin: '0 0 14px',
  },
  chipsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  picksRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  picksLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#10B981',
    minWidth: 65,
  },
  avoidLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#EF4444',
    minWidth: 65,
  },
  chipsList: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  pickChip: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#34D399',
    borderRadius: 4,
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  avoidChip: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#F87171',
    borderRadius: 4,
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
}
