import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import SpyDcaModule from './index';

describe('SpyDcaModule Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the SPY DCA module header and default metrics', () => {
    render(<SpyDcaModule />);

    expect(screen.getByText(/Estrategia Core-Satellite: SPY \+ Sectoriales/i)).toBeDefined();
    expect(screen.getByText(/Valuación Actual Cartera/i)).toBeDefined();
    expect(screen.getByText(/Aporte Mensual Planificado/i)).toBeDefined();
  });

  it('switches tabs smoothly between calculator, model, and projections', () => {
    render(<SpyDcaModule />);

    const modelTab = screen.getByText(/Asignación & Ponderaciones/i);
    fireEvent.click(modelTab);
    expect(screen.getByText(/Configuración de Ponderaciones y Precios/i)).toBeDefined();

    const projTab = screen.getByText(/Proyección a Futuro/i);
    fireEvent.click(projTab);
    expect(screen.getByText(/Simulación de Interés Compuesto/i)).toBeDefined();
  });
});
