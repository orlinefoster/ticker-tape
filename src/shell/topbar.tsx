import { useTheme } from '@/theme/useTheme';
import { useServiceStatusStore, OverrideSetting } from '@/store/serviceStatusStore';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { status, override, setOverride } = useServiceStatusStore();

  const renderBadge = (name: string, value: 'connected' | 'mock' | 'disconnected', tooltipPrefix: string) => {
    const config = {
      connected: { symbol: '●', color: 'var(--accent-mint)', bg: 'rgba(0, 245, 212, 0.12)', border: 'rgba(0, 245, 212, 0.35)', title: 'Conectado (Real)' },
      mock: { symbol: '◐', color: 'var(--accent-peach)', bg: 'rgba(255, 224, 130, 0.12)', border: 'rgba(255, 224, 130, 0.35)', title: 'Mock / Simulación' },
      disconnected: { symbol: '○', color: 'var(--signal-bearish)', bg: 'rgba(255, 51, 102, 0.12)', border: 'rgba(255, 51, 102, 0.35)', title: 'Desconectado' },
    }[value];

    return (
      <div
        title={`${tooltipPrefix}: ${config.title}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          border: `1px solid ${config.border}`,
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: config.color,
          backgroundColor: config.bg,
          cursor: 'help',
          userSelect: 'none',
          boxShadow: value === 'connected' ? '0 0 10px rgba(0, 245, 212, 0.2)' : 'none',
          transition: 'all var(--transition-fast)',
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
        height: '52px',
        padding: '0 20px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Left: App title & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--holo-gradient)',
            backgroundSize: '200% 200%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--holo-glow)',
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>📼</span>
        </div>
        <span
          className="holo-gradient-text"
          style={{
            fontWeight: 900,
            fontSize: '1.1rem',
            letterSpacing: '0.04em',
          }}
        >
          TICKER TAPE
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            padding: '2px 7px',
            borderRadius: 'var(--radius-pill)',
            backgroundImage: 'var(--holo-gradient-subtle)',
            color: 'var(--text-bright)',
            border: '1px solid rgba(255, 107, 157, 0.35)',
            fontWeight: 800,
            letterSpacing: '0.05em',
            boxShadow: '0 0 10px rgba(179, 136, 255, 0.2)',
          }}
        >
          HOLO-SAKURA
        </span>
      </div>

      {/* Center: empty for now */}
      <div />

      {/* Right: health badges + override selector + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {renderBadge('DB', status.db, 'Base de Datos (SQLite)')}
          {renderBadge('AI', status.ai, 'Servicio de IA (Ollama)')}
          {renderBadge('DATA', status.data, 'Proveedor de Datos (Yahoo Finance)')}
          {renderBadge('BINANCE', status.binance, 'Proveedor de Criptomonedas (Binance API)')}
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            value={override}
            onChange={(e) => setOverride(e.target.value as OverrideSetting)}
            title="Seleccionar modo de conectividad"
            style={{
              backgroundColor: 'var(--bg-surface-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <option value="Auto">Mode: Auto</option>
            <option value="Real">Mode: Real</option>
            <option value="Mock">Mode: Mock</option>
          </select>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Cyber Dark mode' : 'Switch to Cyber Light mode'}
          style={{
            background: 'var(--bg-surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            lineHeight: 1,
            color: 'var(--text-primary)',
            transition: 'all var(--transition-fast)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {theme === 'light' ? '🌙' : '🌸'}
        </button>
      </div>
    </header>
  );
}
