import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

// Setup minimal testing helpers
describe('Button Component', () => {
  it('renders children with default primary variant', () => {
    render(<Button>Ejecutar Orden</Button>);
    const btn = screen.getByRole('button', { name: /ejecutar orden/i });
    expect(btn).toBeDefined();
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('handles loading state with aria-busy and status role', () => {
    render(<Button isLoading>Guardando</Button>);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders different size styles appropriately', () => {
    render(<Button size="sm">Pequeño</Button>);
    const btn = screen.getByRole('button', { name: /pequeño/i });
    expect(btn.style.fontSize).toBe('0.75rem');
  });

  it('renders dangerous/bearish variant correctly', () => {
    render(<Button variant="danger">Eliminar</Button>);
    const btn = screen.getByRole('button', { name: /eliminar/i });
    expect(btn.style.background).toBe('var(--signal-bearish)');
  });
});
