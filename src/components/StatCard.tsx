import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  color?: string;
  style?: React.CSSProperties;
}

export function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  color = 'var(--accent)',
  style,
}: StatCardProps) {
  const getChangeColor = () => {
    if (changeType === 'positive') return '#4caf50';
    if (changeType === 'negative') return '#f44336';
    return 'var(--text-secondary)';
  };

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        {icon && <span style={{ fontSize: '1.125rem' }}>{icon}</span>}
      </div>
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: color,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {change && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: getChangeColor(),
          }}
        >
          {change}
        </div>
      )}
    </div>
  );
}
