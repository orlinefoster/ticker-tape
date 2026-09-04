import { useTheme } from '@/theme/useTheme';
import { useServiceStatusStore, OverrideSetting } from '@/store/serviceStatusStore';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { status, override, setOverride } = useServiceStatusStore();

  const renderBadge = (name: string, value: 'connected' | 'mock' | 'disconnected', tooltipPrefix: string) => {
    const config = {
      connected: { symbol: '✓', color: '#4caf50', title: 'Conectado (Real)' },
      mock: { symbol: '~', color: '#fbc02d', title: 'Mock / Simulación' },
      disconnected: { symbol: '✗', color: '#f44336', title: 'Desconectado' },
    }[value];

    return (
      <div
        title={`${tooltipPrefix}: ${config.title}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          border: `1px solid ${config.color}`,
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          color: config.color,
          backgroundColor: `${config.color}10`,
          cursor: 'help',
          userSelect: 'none',
        }}
      >
        <span>{name}</span>
        <span>{config.symbol}</span>
      </div>
    );
  };

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

      {/* Right: health badges + override selector + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {renderBadge('DB', status.db, 'Base de Datos (SQLite)')}
          {renderBadge('AI', status.ai, 'Servicio de IA (Ollama)')}
          {renderBadge('DATA', status.data, 'Proveedor de Datos (Yahoo Finance)')}
          {renderBadge('BINANCE', status.binance, 'Proveedor de Criptomonedas (Binance API)')}
        </div>

        {/* Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            value={override}
            onChange={(e) => setOverride(e.target.value as OverrideSetting)}
            title="Seleccionar modo de simulación o conectividad real"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '4px 6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="Auto">Auto</option>
            <option value="Real">Real</option>
            <option value="Mock">Mock</option>
          </select>
        </div>

        {/* Theme Toggle */}
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
      </div>
    </header>
  );
}
