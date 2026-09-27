import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './errorBoundary';

function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Fallo simulado en motor de cálculo');
  }
  return <div>Componente Operativo</div>;
}

function TestContainer() {
  const [hasError, setHasError] = useState(true);
  return (
    <ErrorBoundary
      fallback={(_err, retry) => (
        <div>
          <span>Error Capturado</span>
          <button
            onClick={() => {
              setHasError(false);
              retry();
            }}
          >
            Reintentar Prueba
          </button>
        </div>
      )}
    >
      <BombComponent shouldThrow={hasError} />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  it('catches render errors and displays fallback with role=alert', () => {
    // Suppress console.error in test output for intentional errors
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Fallo simulado en motor de cálculo');

    spy.mockRestore();
  });

  it('supports custom render prop fallback and retry mechanism', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TestContainer />);
    expect(screen.getByText('Error Capturado')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /reintentar prueba/i });
    fireEvent.click(retryBtn);

    expect(screen.getByText('Componente Operativo')).toBeDefined();

    spy.mockRestore();
  });
});
