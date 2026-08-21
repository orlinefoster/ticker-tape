import type { KeyRatios } from './index'

interface Props {
  ratios: KeyRatios
}

const TREND_ICONS: Record<string, string> = {
  Rising: '↑',
  Falling: '↓',
  Sideways: '→',
}

const TREND_COLORS: Record<string, string> = {
  Rising: '#4caf50',
  Falling: '#f44336',
  Sideways: '#ff9800',
}

export function RatiosPanel({ ratios }: Props) {
  const items = [
    {
      name: 'Stock/Bond (SPY/TLT)',
      value: ratios.stock_bond.toFixed(2),
      trend: ratios.stock_bond_trend,
      desc: 'Apetito por riesgo',
    },
    {
      name: 'Cíclico/Defensivo',
      value: ratios.cyclical_defensive.toFixed(2),
      trend: ratios.cyclical_defensive_trend,
      desc: 'Fase económica',
    },
    {
      name: 'Commodity/Bond (DBC/TLT)',
      value: ratios.commodity_bond.toFixed(2),
      trend: ratios.commodity_bond_trend,
      desc: 'Presiones inflacionarias',
    },
    {
      name: 'Índice Dólar (DXY)',
      value: ratios.dollar_ratio.toFixed(1),
      trend: ratios.dollar_trend,
      desc: 'Fortaleza del dólar',
    },
  ]

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Ratios Clave</h3>
      <div style={styles.grid}>
        {items.map((item, i) => (
          <div key={i} style={styles.item}>
            <div style={styles.itemHeader}>
              <span style={styles.itemName}>{item.name}</span>
              <span style={{
                color: TREND_COLORS[item.trend] || 'var(--text-secondary)',
                fontSize: 20,
                fontWeight: 700,
              }}>
                {TREND_ICONS[item.trend] || '?'}
              </span>
            </div>
            <div style={styles.value}>{item.value}</div>
            <div style={styles.desc}>{item.desc}</div>
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  },
  item: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    padding: 16,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  value: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
}
