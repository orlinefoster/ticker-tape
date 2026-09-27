import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CorrelationHeatmap } from './CorrelationHeatmap'

describe('CorrelationHeatmap Component', () => {
  const mockCorrelations = {
    symbols: ['SPY', 'QQQ', 'TLT'],
    correlations: [
      [1.0, 0.85, -0.3],
      [0.85, 1.0, -0.25],
      [-0.3, -0.25, 1.0],
    ],
  }

  const mockHrpOrder = ['TLT', 'SPY', 'QQQ']

  it('renders heatmap title and matrix values', () => {
    render(
      <CorrelationHeatmap
        correlations={mockCorrelations}
        hrpOrder={mockHrpOrder}
        windowDays={63}
      />
    )

    expect(screen.getByText('Matriz de Correlación Interactivo')).toBeDefined()
    expect(screen.getByText('Ventana 63d')).toBeDefined()
    expect(screen.getAllByText('0.85').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-0.30').length).toBeGreaterThanOrEqual(1)
  })

  it('toggles between HRP order and original order', () => {
    render(
      <CorrelationHeatmap
        correlations={mockCorrelations}
        hrpOrder={mockHrpOrder}
        windowDays={63}
      />
    )

    const toggleBtn = screen.getByText('✓ Orden HRP (Clústeres)')
    expect(toggleBtn).toBeDefined()

    // Click toggle to switch to original order
    fireEvent.click(toggleBtn)
    expect(screen.getByText('Usar Orden HRP (Clústeres)')).toBeDefined()
  })

  it('displays educational rebalancing guide', () => {
    render(
      <CorrelationHeatmap
        correlations={mockCorrelations}
        hrpOrder={mockHrpOrder}
        windowDays={63}
      />
    )

    expect(
      screen.getByText('CÓMO APLICAR ESTA INFORMACIÓN AL REBALANCEO DE CARTERA (HRP)')
    ).toBeDefined()
  })
})
