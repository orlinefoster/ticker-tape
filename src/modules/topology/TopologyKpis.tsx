import React from 'react'
import { Card, Badge } from '@/components/ui'
import type { TopologyMetrics, NodeCentrality, RegimeInfo } from './types'

interface TopologyKpisProps {
  metrics?: TopologyMetrics
  centrality?: NodeCentrality[]
  regimes: RegimeInfo[]
}

export const TopologyKpis: React.FC<TopologyKpisProps> = ({
  metrics,
  centrality = [],
  regimes,
}) => {
  const hubNode = centrality.find((c) => c.is_hub) || centrality[0]
  const primaryRegime = regimes[0]

  const getStressBadgeVariant = (status?: string) => {
    if (!status) return 'neutral'
    if (status.includes('Saludable') || status.includes('Amplia')) return 'bullish'
    if (status.includes('Moderado') || status.includes('Transición')) return 'warning'
    return 'bearish'
  }

  const getRegimeBadgeVariant = (regime?: string) => {
    switch (regime) {
      case 'risk-on':
        return 'bullish'
      case 'risk-off':
        return 'bearish'
      case 'divergent':
        return 'warning'
      default:
        return 'neutral'
    }
  }

  return (
    <div style={styles.grid}>
      {/* KPI 1: Hub Sistémico */}
      <Card variant="filled" style={styles.card}>
        <div style={styles.kpiHeader}>
          <span style={styles.kpiLabel}>HUB SISTÉMICO (MST)</span>
          <Badge variant="primary" pulse>
            Líder de Red
          </Badge>
        </div>
        <div style={styles.kpiValueRow}>
          <span style={styles.kpiPrimaryValue}>
            {metrics?.hub_symbol || hubNode?.symbol || 'N/A'}
          </span>
          {hubNode && (
            <span style={styles.kpiSecondaryValue}>
              {hubNode.degree} conex · {Math.round(hubNode.betweenness * 100)}% Betweenness
            </span>
          )}
        </div>
        <p style={styles.kpiDescription}>
          Activo con mayor centralidad topológica. Actúa como puente principal de contagio y
          transmisión de volatilidad.
        </p>
      </Card>

      {/* KPI 2: Estrés de Red / Diversificación L_MST */}
      <Card variant="filled" style={styles.card}>
        <div style={styles.kpiHeader}>
          <span style={styles.kpiLabel}>LONGITUD DE ÁRBOL (L_MST)</span>
          <Badge variant={getStressBadgeVariant(metrics?.stress_status)}>
            {metrics?.stress_status || 'Normal'}
          </Badge>
        </div>
        <div style={styles.kpiValueRow}>
          <span style={styles.kpiPrimaryValue}>
            {metrics ? metrics.normalized_tree_length.toFixed(2) : '1.41'}
          </span>
          <span style={styles.kpiSecondaryValue}>
            Ventana {metrics?.window_days || 63}d · Distancia Mantegna
          </span>
        </div>
        <p style={styles.kpiDescription}>
          {metrics && metrics.normalized_tree_length < 1.0
            ? 'Colapso de distancia: los activos se mueven sincrónicos. Falsa diversificación.'
            : 'Espacio métrico amplio: diversificación genuina y baja sincronización de shock.'}
        </p>
      </Card>

      {/* KPI 3: Régimen Dominante */}
      <Card variant="filled" style={styles.card}>
        <div style={styles.kpiHeader}>
          <span style={styles.kpiLabel}>RÉGIMEN DE MERCADO</span>
          <Badge variant={getRegimeBadgeVariant(primaryRegime?.regime)}>
            {primaryRegime?.regime?.toUpperCase() || 'NORMAL'}
          </Badge>
        </div>
        <div style={styles.kpiValueRow}>
          <span style={{ ...styles.kpiPrimaryValue, textTransform: 'capitalize' }}>
            {primaryRegime?.regime || 'Normal'}
          </span>
          {primaryRegime?.affected_symbols && primaryRegime.affected_symbols.length > 0 && (
            <span style={styles.kpiSecondaryValue}>
              {primaryRegime.affected_symbols.length} afectados
            </span>
          )}
        </div>
        <p style={styles.kpiDescription}>
          {primaryRegime?.description || 'Condiciones de correlación y tendencia promedio estables.'}
        </p>
      </Card>

      {/* KPI 4: Correlación Media */}
      <Card variant="filled" style={styles.card}>
        <div style={styles.kpiHeader}>
          <span style={styles.kpiLabel}>CORRELACIÓN MEDIA</span>
          <Badge variant="neutral">Inter-asset</Badge>
        </div>
        <div style={styles.kpiValueRow}>
          <span
            style={{
              ...styles.kpiPrimaryValue,
              color:
                (metrics?.avg_correlation ?? 0) > 0.5
                  ? 'var(--signal-warning)'
                  : (metrics?.avg_correlation ?? 0) < 0.2
                  ? 'var(--signal-bullish)'
                  : 'var(--text-primary)',
            }}
          >
            {metrics ? `${(metrics.avg_correlation * 100).toFixed(1)}%` : '0.0%'}
          </span>
          <span style={styles.kpiSecondaryValue}>
            {metrics && metrics.avg_correlation > 0.6
              ? 'Sincronización alta'
              : metrics && metrics.avg_correlation < 0.25
              ? 'Descorrelación alta'
              : 'Acoplamiento moderado'}
          </span>
        </div>
        <p style={styles.kpiDescription}>
          Promedio de correlaciones fuera de la diagonal. A menor correlación promedio, mayor ratio
          de Sharpe potencial en rebalanceo.
        </p>
      </Card>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px',
  },
  kpiHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  kpiValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '6px',
  },
  kpiPrimaryValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  kpiSecondaryValue: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  kpiDescription: {
    fontSize: '12px',
    lineHeight: 1.4,
    color: 'var(--text-secondary)',
    margin: 0,
  },
}
