import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-surface-card)',
            border: '1px solid var(--signal-bearish-muted)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--signal-bearish)', fontWeight: 700, fontSize: '0.95rem' }}>
            <span>⚠️</span>
            <span>Error en la ejecución del módulo</span>
          </div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              margin: '0',
              fontFamily: "'JetBrains Mono', monospace",
              maxWidth: '550px',
              backgroundColor: 'var(--bg-canvas)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message || 'Error inesperado del sistema'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-bright)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            aria-label="Reintentar cargar el módulo"
          >
            🔄 Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
