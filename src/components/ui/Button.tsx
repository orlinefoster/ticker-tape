import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'bullish' | 'bearish' | 'sakura' | 'mint' | 'lavender' | 'holo' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  style,
  disabled,
  ...props
}) => {
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '4px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' };
      case 'lg':
        return { padding: '10px 20px', fontSize: '0.95rem', borderRadius: 'var(--radius)' };
      case 'md':
      default:
        return { padding: '7px 14px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' };
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--accent)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: 'var(--shadow-card)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-surface-card)',
          color: 'var(--text-bright)',
          border: '1px solid var(--border)',
        };
      case 'danger':
      case 'bearish':
        return {
          background: 'var(--signal-bearish)',
          color: '#FFFFFF',
          border: 'none',
        };
      case 'bullish':
      case 'mint':
        return {
          background: 'var(--signal-bullish)',
          color: '#0A0C10',
          border: 'none',
        };
      case 'holo':
        return {
          background: 'var(--holo-gradient)',
          color: 'var(--text-bright)',
          border: '1px solid var(--border)',
        };
      case 'lavender':
        return {
          background: 'var(--accent-lavender)',
          color: '#0A0C10',
          border: 'none',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        };
      case 'sakura':
      default:
        return {
          background: 'var(--accent)',
          color: '#FFFFFF',
          border: 'none',
        };
    }
  };

  return (
    <button
      type={props.type || 'button'}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
        ...getSizeStyles(),
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading && <span role="status" aria-label="Cargando..." style={{ animation: 'spin 1s linear infinite' }}>⏳</span>}
      {children}
    </button>
  );
};
