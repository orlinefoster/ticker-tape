import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card Component & Compound Architecture', () => {
  it('renders card root with custom styles and classes', () => {
    render(<Card data-testid="test-card">Contenido de la tarjeta</Card>);
    const card = screen.getByTestId('test-card');
    expect(card).toBeDefined();
    expect(card.textContent).toContain('Contenido de la tarjeta');
  });

  it('renders compound structure (Header, Title, Description, Content, Footer)', () => {
    render(
      <Card data-testid="compound-card">
        <Card.Header>
          <Card.Title as="h2">Estructura Intermarket</Card.Title>
          <Card.Description>Relación Renta Variable vs Bonos</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>Módulo de correlación</p>
        </Card.Content>
        <Card.Footer>
          <span>Footer Actions</span>
        </Card.Footer>
      </Card>
    );

    expect(screen.getByRole('heading', { level: 2, name: /estructura intermarket/i })).toBeDefined();
    expect(screen.getByText(/relación renta variable vs bonos/i)).toBeDefined();
    expect(screen.getByText(/módulo de correlación/i)).toBeDefined();
    expect(screen.getByText(/footer actions/i)).toBeDefined();
  });

  it('applies primary variant borders and shadow correctly', () => {
    render(<Card variant="primary" data-testid="primary-card">Card Primaria</Card>);
    const card = screen.getByTestId('primary-card');
    expect(card.style.border).toContain('1px solid');
  });
});
