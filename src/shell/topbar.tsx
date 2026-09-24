import { useTheme } from '@/theme/useTheme';
import { useServiceStatusStore, OverrideSetting } from '@/store/serviceStatusStore';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { status, override, setOverride } = useServiceStatusStore();

  const renderBadge = (name: string, value: 'connected' | 'mock' | 'disconnected', tooltipPrefix: string) => {
    const config = {
      connected: { symbol: '●', color: 'var(--signal-bullish)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', title: 'Conectado (Real)' },
      mock: { symbol: '◐', color: 'var(--signal-warning)', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', title: 'Mock / Simulación' },
      disconnected: { symbol: '○', color: 'var(--signal-bearish)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', title: 'Desconectado' },
    }[value];

    return (
      <div
        title={`${tooltipPrefix}: ${config.title}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 8px',
          border: `1px solid ${config.border}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.72rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          letterSpacing: '0.03em',
          color: config.color,
          backgroundColor: config.bg,
          cursor: 'help',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '0.65rem' }}>{config.symbol}</span>
        <span>{name}</span>
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
        height: '46px',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      {/* Left: App title & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>📼</span>
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: '0.95rem',
            letterSpacing: '0.06em',
            color: 'var(--text-bright)',
            fontFamily: 'monospace',
          }}
        >
          TICKER TAPE
        </span>
        <span
          style={{
            fontSize: '0.62rem',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-card)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            fontFamily: 'monospace',
          }}
        >
          TERMINAL 16:9
        </span>
      </div>

      {/* Center: Quick market ticker summary / status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)',
          fontFamily: 'monospace',
        }}
      >
        <span>
          CCL: <strong style={{ color: 'var(--text-bright)' }}>$1,320</strong>
        </span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>
          MEP: <strong style={{ color: 'var(--text-bright)' }}>$1,295</strong>
        </span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>
          BTC/USDT: <strong style={{ color: 'var(--signal-bullish)' }}>$67,250</strong>
        </span>
      </div>

      {/* Right: health badges + override selector + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {renderBadge('DB', status.db, 'Base de Datos (SQLite)')}
          {renderBadge('DATA', status.data, 'Proveedor de Datos (Yahoo Finance)')}
          {renderBadge('BINANCE', status.binance, 'Proveedor de Criptomonedas (Binance API)')}
          {renderBadge('AI', status.ai, 'Servicio de IA (Ollama)')}
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select
            value={override}
            onChange={(e) => setOverride(e.target.value as OverrideSetting)}
            title="Seleccionar modo de conectividad"
            style={{
              backgroundColor: 'var(--bg-surface-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'monospace',
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
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          style={{
            background: 'var(--bg-surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 7px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            lineHeight: 1,
            color: 'var(--text-primary)',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}
