import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'bullish' | 'bearish' | 'warning' | 'neutral' | 'sakura' | 'mint' | 'lavender' | 'peach';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  pulse = false,
  children,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          color: 'var(--accent)',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          glow: 'rgba(59, 130, 246, 0.25)',
        };
      case 'mint':
      case 'bullish':
        return {
          color: 'var(--signal-bullish)',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          glow: 'rgba(16, 185, 129, 0.25)',
        };
      case 'bearish':
        return {
          color: 'var(--signal-bearish)',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.3)',
          glow: 'rgba(239, 68, 68, 0.25)',
        };
      case 'warning':
      case 'peach':
        return {
          color: 'var(--signal-warning)',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          glow: 'rgba(245, 158, 11, 0.25)',
        };
      case 'lavender':
        return {
          color: 'var(--accent-lavender)',
          bg: 'rgba(129, 140, 248, 0.12)',
          border: 'rgba(129, 140, 248, 0.3)',
          glow: 'rgba(129, 140, 248, 0.25)',
        };
      case 'neutral':
        return {
          color: 'var(--signal-neutral)',
          bg: 'rgba(100, 116, 139, 0.12)',
          border: 'rgba(100, 116, 139, 0.25)',
          glow: 'transparent',
        };
      case 'sakura':
      default:
        return {
          color: 'var(--accent)',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          glow: 'rgba(59, 130, 246, 0.25)',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <span
      role={props.role || 'status'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.03em',
        color: v.color,
        backgroundColor: v.bg,
        border: `1px solid ${v.border}`,
        boxShadow: pulse ? `0 0 10px ${v.glow}` : 'none',
        userSelect: 'none',
        ...style,
      }}
      {...props}
    >
      {pulse && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: v.color,
            boxShadow: `0 0 6px ${v.color}`,
          }}
        />
      )}
      {children}
    </span>
  );
};
