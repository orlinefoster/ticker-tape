import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'sakura' | 'mint' | 'lavender' | 'peach' | 'bullish' | 'bearish' | 'neutral';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'sakura',
  pulse = false,
  children,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'mint':
      case 'bullish':
        return {
          color: 'var(--signal-bullish)',
          bg: 'rgba(0, 245, 160, 0.12)',
          border: 'rgba(0, 245, 160, 0.3)',
          glow: 'rgba(0, 245, 160, 0.25)',
        };
      case 'bearish':
        return {
          color: 'var(--signal-bearish)',
          bg: 'rgba(255, 51, 102, 0.12)',
          border: 'rgba(255, 51, 102, 0.3)',
          glow: 'rgba(255, 51, 102, 0.25)',
        };
      case 'lavender':
        return {
          color: 'var(--accent-lavender)',
          bg: 'rgba(179, 136, 255, 0.12)',
          border: 'rgba(179, 136, 255, 0.3)',
          glow: 'rgba(179, 136, 255, 0.25)',
        };
      case 'peach':
        return {
          color: 'var(--accent-peach)',
          bg: 'rgba(255, 224, 130, 0.12)',
          border: 'rgba(255, 224, 130, 0.3)',
          glow: 'rgba(255, 224, 130, 0.25)',
        };
      case 'neutral':
        return {
          color: 'var(--signal-neutral)',
          bg: 'rgba(140, 147, 181, 0.12)',
          border: 'rgba(140, 147, 181, 0.25)',
          glow: 'transparent',
        };
      case 'sakura':
      default:
        return {
          color: 'var(--accent-sakura)',
          bg: 'rgba(255, 107, 157, 0.12)',
          border: 'rgba(255, 107, 157, 0.3)',
          glow: 'rgba(255, 107, 157, 0.25)',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <span
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
