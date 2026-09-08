import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glow-sakura' | 'glow-mint' | 'glow-lavender';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'glass':
        return {
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
        };
      case 'glow-sakura':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 20px rgba(255, 107, 157, 0.2)',
        };
      case 'glow-mint':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border-mint)',
          boxShadow: '0 0 20px rgba(0, 245, 212, 0.2)',
        };
      case 'glow-lavender':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid rgba(179, 136, 255, 0.3)',
          boxShadow: '0 0 20px rgba(179, 136, 255, 0.2)',
        };
      case 'default':
      default:
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border-subtle)',
        };
    }
  };

  return (
    <div
      className={`cyber-card ${className}`}
      style={{
        borderRadius: 'var(--radius)',
        padding: '16px',
        boxShadow: 'var(--shadow-card)',
        transition: 'all var(--transition)',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
