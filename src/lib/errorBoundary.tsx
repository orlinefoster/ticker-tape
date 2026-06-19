import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
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

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError?.(error);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '24px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#e53935', fontWeight: 600, margin: '0 0 8px' }}>
            Something went wrong
          </p>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              margin: '0 0 16px',
              fontFamily: 'monospace',
            }}
          >
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
