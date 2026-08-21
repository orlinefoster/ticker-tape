interface Props {
  phase: string
  label: string
  emoji: string
  confidence: number
}

const PHASE_COLORS: Record<string, string> = {
  EarlyExpansion: '#4caf50',
  LateExpansion: '#8bc34a',
  Peak: '#ff9800',
  Contraction: '#f44336',
  Trough: '#2196f3',
}

const PHASE_ORDER = ['Contraction', 'Trough', 'EarlyExpansion', 'LateExpansion', 'Peak']

export function CycleIndicator({ phase, label, emoji, confidence }: Props) {
  const color = PHASE_COLORS[phase] || '#9e9e9e'
  const phaseIndex = PHASE_ORDER.indexOf(phase)

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Fase del Ciclo</h3>

      <div style={styles.phaseDisplay}>
        <div style={{ ...styles.iconCircle, backgroundColor: color + '20', borderColor: color }}>
          <span style={{ fontSize: 48 }}>{emoji}</span>
        </div>
        <div>
          <div style={{ ...styles.phaseLabel, color }}>{label}</div>
          <div style={styles.confidenceBar}>
            <div style={styles.confidenceLabel}>
              <span>Confianza</span>
              <span>{(confidence * 100).toFixed(0)}%</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${confidence * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline visual */}
      <div style={styles.timeline}>
        {PHASE_ORDER.map((p, i) => (
          <div key={p} style={styles.timelineItem}>
            <div style={{
              ...styles.timelineDot,
              backgroundColor: i <= phaseIndex ? (PHASE_COLORS[p] || '#9e9e9e') : 'var(--bg-tertiary)',
            }} />
            <div style={{
              ...styles.timelineLabel,
              fontWeight: p === phase ? 700 : 400,
              color: p === phase ? PHASE_COLORS[p] : 'var(--text-secondary)',
            }}>
              {PHASE_ORDER[i]}
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div style={{
                ...styles.timelineLine,
                backgroundColor: i < phaseIndex ? color : 'var(--border)',
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 20,
    boxShadow: 'var(--shadow)',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
  },
  phaseDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid',
    flexShrink: 0,
  },
  phaseLabel: {
    fontSize: 24,
    fontWeight: 700,
  },
  confidenceBar: {
    marginTop: 12,
    minWidth: 200,
  },
  confidenceLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
  barBg: {
    height: 8,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  },
  timeline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    overflow: 'hidden',
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    zIndex: 1,
    transition: 'background-color 0.3s',
  },
  timelineLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  timelineLine: {
    position: 'absolute',
    top: 6,
    left: '50%',
    width: '100%',
    height: 2,
    zIndex: 0,
  },
}
