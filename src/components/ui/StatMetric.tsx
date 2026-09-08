import React from 'react';
import { Card } from './Card';

export interface StatMetricProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  accentColor?: 'sakura' | 'mint' | 'lavender' | 'peach';
  subtext?: string;
}

export const StatMetric: React.FC<StatMetricProps> = ({
  label,
  value,
  delta,
  deltaLabel,
  accentColor = 'sakura',
  subtext,
}) => {
  const getAccent = () => {
    switch (accentColor) {
      case 'mint':
        return 'var(--accent-mint)';
      case 'lavender':
        return 'var(--accent-lavender)';
      case 'peach':
        return 'var(--accent-peach)';
      case 'sakura':
      default:
        return 'var(--accent-sakura)';
    }
  };

  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <Card style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: getAccent(),
            boxShadow: `0 0 8px ${getAccent()}`,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span
          className="font-mono"
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--text-bright)',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>

        {delta !== undefined && (
          <span
            className="font-mono"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isPositive ? 'var(--signal-bullish)' : isNegative ? 'var(--signal-bearish)' : 'var(--signal-neutral)',
            }}
          >
            {isPositive ? `+${delta.toFixed(2)}%` : `${delta.toFixed(2)}%`} {deltaLabel}
          </span>
        )}
      </div>

      {subtext && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {subtext}
        </span>
      )}
    </Card>
  );
};
