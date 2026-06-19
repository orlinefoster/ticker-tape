import { useState } from 'react';

interface StatCard {
  label: string;
  value: string;
}

const stats: StatCard[] = [
  { label: 'Symbols Watched', value: '12' },
  { label: 'Signals Today', value: '8' },
  { label: 'Active Strategies', value: '3' },
  { label: 'Uptime', value: '99.9%' },
];

export function Dashboard() {
  const [connected] = useState(true);

  return (
    <div className="dashboard">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            System overview and quick actions
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius)',
            backgroundColor: connected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
            border: `1px solid ${connected ? '#4caf50' : '#f44336'}`,
          }}
        >
          <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{connected ? '🟢' : '🔴'}</span>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: connected ? '#4caf50' : '#f44336',
            }}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '20px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Command Placeholders */}
      <div
        style={{
          padding: '20px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Quick Actions
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {[
            { label: 'Greet', desc: 'Test IPC connectivity' },
            { label: 'Market Data', desc: 'Fetch OHLCV bars' },
            { label: 'Run Strategy', desc: 'Apply a trading strategy' },
            { label: 'Backtest', desc: 'Run backtest simulation' },
          ].map((cmd) => (
            <div
              key={cmd.label}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'border-color var(--transition)',
              }}
            >
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {cmd.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {cmd.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
