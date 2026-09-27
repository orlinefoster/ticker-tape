import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopologyKpis } from './TopologyKpis'
import type { TopologyMetrics, NodeCentrality, RegimeInfo } from './types'

describe('TopologyKpis Component', () => {
  const mockMetrics: TopologyMetrics = {
    normalized_tree_length: 1.45,
    hub_symbol: 'SPY',
    avg_correlation: 0.35,
    stress_status: 'Diversificación Amplia / Saludable',
    window_days: 63,
  }

  const mockCentrality: NodeCentrality[] = [
    { symbol: 'SPY', degree: 4, betweenness: 0.8, is_hub: true },
    { symbol: 'QQQ', degree: 2, betweenness: 0.1, is_hub: false },
  ]

  const mockRegimes: RegimeInfo[] = [
    {
      regime: 'risk-on',
      description: 'Fuerte apetito por riesgo en índices.',
      affected_symbols: ['SPY', 'QQQ'],
    },
  ]

  it('renders systemic hub symbol and stats correctly', () => {
    render(
      <TopologyKpis
        metrics={mockMetrics}
        centrality={mockCentrality}
        regimes={mockRegimes}
      />
    )

    expect(screen.getByText('SPY')).toBeDefined()
    expect(screen.getByText('HUB SISTÉMICO (MST)')).toBeDefined()
    expect(screen.getByText('4 conex · 80% Betweenness')).toBeDefined()
  })

  it('renders tree length and stress status correctly', () => {
    render(
      <TopologyKpis
        metrics={mockMetrics}
        centrality={mockCentrality}
        regimes={mockRegimes}
      />
    )

    expect(screen.getByText('1.45')).toBeDefined()
    expect(screen.getByText('Diversificación Amplia / Saludable')).toBeDefined()
  })

  it('renders regime badge and average correlation correctly', () => {
    render(
      <TopologyKpis
        metrics={mockMetrics}
        centrality={mockCentrality}
        regimes={mockRegimes}
      />
    )

    expect(screen.getByText('RISK-ON')).toBeDefined()
    expect(screen.getByText('35.0%')).toBeDefined()
  })
})
