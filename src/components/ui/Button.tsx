import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'sakura' | 'mint' | 'lavender' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'sakura',
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
      case 'mint':
        return {
          background: 'var(--accent-mint)',
          color: '#0B0D17',
          border: 'none',
          boxShadow: '0 0 14px rgba(0, 245, 212, 0.3)',
        };
      case 'lavender':
        return {
          background: 'var(--accent-lavender)',
          color: '#0B0D17',
          border: 'none',
          boxShadow: '0 0 14px rgba(179, 136, 255, 0.3)',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--accent-sakura)',
          border: '1px solid var(--accent-sakura)',
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
          background: 'var(--accent-sakura)',
          color: '#0B0D17',
          border: 'none',
          boxShadow: '0 0 14px rgba(255, 107, 157, 0.35)',
        };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
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
        outline: 'none',
        ...getSizeStyles(),
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading && <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>}
      {children}
    </button>
  );
};
