import React, { type ReactNode } from 'react';

export interface CardProps {
  title?: string;
  subtitle?: string;
  extra?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ title, subtitle, extra, children, style, className }: CardProps) {
  return (
    <div
      className={`app-card ${className || ''}`}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        ...style,
      }}
    >
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
