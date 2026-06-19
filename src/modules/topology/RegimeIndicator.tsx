interface RegimeInfo {
  regime: string
  description: string
  affected_symbols: string[]
}

interface Props {
  regimes: RegimeInfo[]
}

const REGIME_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'risk-on': {
    color: '#2e7d32',
    bg: '#e8f5e9',
    icon: '🚀',
  },
  'risk-off': {
    color: '#c62828',
    bg: '#ffebee',
    icon: '🛡️',
  },
  divergent: {
    color: '#e65100',
    bg: '#fff3e0',
    icon: '🔀',
  },
  normal: {
    color: '#1565c0',
    bg: '#e3f2fd',
    icon: '⚖️',
  },
}

/** Regime name in a human-readable format. */
function formatRegime(regime: string): string {
  const map: Record<string, string> = {
    'risk-on': 'Risk On',
    'risk-off': 'Risk Off',
    divergent: 'Divergent',
    normal: 'Normal',
  }
  return map[regime] || regime
}

/**
 * Displays the current market regime(s) with icon, colour, description,
 * and any affected symbols.
 */
export function RegimeIndicator({ regimes }: Props) {
  if (regimes.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Market Regime</h3>
        <p style={styles.empty}>No regime data available.</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Market Regime</h3>
      <div style={styles.regimeList}>
        {regimes.map((r, i) => {
          const config = REGIME_CONFIG[r.regime] ?? {
            color: 'var(--text-primary)',
            bg: 'var(--bg-tertiary)',
            icon: '❓',
          }

          return (
            <div
              key={i}
              style={{
                ...styles.regimeCard,
                borderLeft: `4px solid ${config.color}`,
                backgroundColor: config.bg,
              }}
            >
              <div style={styles.regimeHeader}>
                <span style={{ fontSize: 28 }}>{config.icon}</span>
                <div>
                  <div style={{ ...styles.regimeName, color: config.color }}>
                    {formatRegime(r.regime)}
                  </div>
                  <div style={styles.description}>{r.description}</div>
                </div>
              </div>

              {r.affected_symbols.length > 0 && (
                <div style={styles.affectedSection}>
                  <span style={styles.affectedLabel}>Divergent symbols:</span>
                  <div style={styles.affectedTags}>
                    {r.affected_symbols.map((sym) => (
                      <span
                        key={sym}
                        style={{
                          ...styles.affectedTag,
                          border: `1px solid ${config.color}`,
                          color: config.color,
                        }}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
  },
  empty: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 16,
  },
  regimeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  regimeCard: {
    borderRadius: 'var(--radius)',
    padding: 16,
  },
  regimeHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  regimeName: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    opacity: 0.8,
  },
  affectedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid rgba(0,0,0,0.08)',
  },
  affectedLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: 6,
  },
  affectedTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  affectedTag: {
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
}
