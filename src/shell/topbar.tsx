import { useTheme } from '@/theme/useTheme';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const connected = true; // Will be wired to Tauri event in later phase

  return (
    <header
      className="topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '48px',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-primary)',
        flexShrink: 0,
      }}
    >
      {/* Left: App title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🎞️</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          Ticker Tape
        </span>
      </div>

      {/* Center: empty for now */}
      <div />

      {/* Right: theme toggle + connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
            color: 'var(--text-primary)',
            transition: 'background var(--transition)',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <span
          title={connected ? 'Connected' : 'Disconnected'}
          style={{ fontSize: '0.875rem', lineHeight: 1 }}
        >
          {connected ? '🟢' : '🔴'}
        </span>
      </div>
    </header>
  );
}
