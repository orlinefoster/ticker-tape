import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders with status role by default for accessibility', () => {
    render(<Badge>Activo</Badge>);
    const badge = screen.getByRole('status');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Activo');
  });

  it('renders bullish variant with green signal colors', () => {
    render(<Badge variant="bullish">COMPRA 1R</Badge>);
    const badge = screen.getByRole('status');
    expect(badge.style.color).toBe('var(--signal-bullish)');
  });

  it('renders bearish variant with red signal colors', () => {
    render(<Badge variant="bearish">STOP LOSS</Badge>);
    const badge = screen.getByRole('status');
    expect(badge.style.color).toBe('var(--signal-bearish)');
  });

  it('renders warning variant with amber colors', () => {
    render(<Badge variant="warning">ALERTA LIQUIDEZ</Badge>);
    const badge = screen.getByRole('status');
    expect(badge.style.color).toBe('var(--signal-warning)');
  });
});
