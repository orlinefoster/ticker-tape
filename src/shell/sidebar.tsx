import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';

interface NavItem {
  route: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { route: '/', label: 'Dashboard', icon: '📊' },
  { route: '/chart', label: 'Gráfico', icon: '📉' },
  { route: '/providers', label: 'Proveedores', icon: '🔌' },
  { route: '/intermarket', label: 'Intermarket', icon: '🔄' },
  { route: '/topology', label: 'Topology', icon: '🔗' },
  { route: '/relative-perf', label: 'Alpha Rotation', icon: '📡' },
  { route: '/backtesting', label: 'Backtesting', icon: '📈' },
  { route: '/elliott', label: 'Elliott Wave', icon: '🌊' },
  { route: '/portfolio', label: 'Portfolio', icon: '💼' },
  { route: '/monitor', label: 'Monitor', icon: '👁️' },
];

export function Sidebar() {
  const {
    sidebarCollapsed,
    activeRoute,
    containers,
    activeContainerId,
    toggleSidebar,
    setActiveRoute,
    addContainer,
    removeContainer,
    setActiveContainer,
  } = useUIStore();

  const [showPicker, setShowPicker] = useState(false);

  const handleCreateContainer = (route: string, label: string, icon: string) => {
    const existingCount = containers.filter((c) => c.moduleRoute === route).length;
    const name = existingCount > 0 ? `${label} #${existingCount + 1}` : label;
    addContainer(route, name, icon);
    setShowPicker(false);
  };

  return (
    <aside
      className="sidebar"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        minWidth: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        transition: 'width var(--transition)',
        userSelect: 'none',
      }}
    >
      {/* Upper Nav Section: Main Navigation */}
      <nav
        className="sidebar-nav"
        style={{
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeContainerId === null && activeRoute === item.route;
          return (
            <button
              key={item.route}
              className={`sidebar-item${isActive ? ' active' : ''}`}
              onClick={() => setActiveRoute(item.route)}
              title={sidebarCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: sidebarCollapsed ? '0' : '12px',
                width: '100%',
                padding: sidebarCollapsed ? '12px 0' : '10px 14px',
                border: 'none',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                borderRadius: 'var(--radius)',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                transition: 'all 0.15s ease',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ margin: '8px 12px', borderTop: '1px solid var(--border)' }} />

      {/* Lower Nav Section: Dynamic Modules & Multi-Window slots */}
      <div
        style={{
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          position: 'relative',
        }}
      >
        {!sidebarCollapsed && (
          <div
            style={{
              padding: '0 8px 4px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            MÓDULOS DESPLEGADOS
          </div>
        )}

        {/* Action Button: "💻 +" */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Desplegar nuevo módulo (💻 +)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: sidebarCollapsed ? '0' : '8px',
            width: '100%',
            padding: sidebarCollapsed ? '10px 0' : '8px 12px',
            border: '1px dashed var(--accent)',
            background: showPicker ? 'var(--bg-primary)' : 'transparent',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>💻 +</span>
          {!sidebarCollapsed && <span>Abrir Módulo</span>}
        </button>

        {/* Dropdown / Span popup picker */}
        {showPicker && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '8px',
              right: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              padding: '8px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                padding: '4px 6px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '4px',
              }}
            >
              Seleccionar Módulo a Desplegar:
            </div>
            {navItems.map((mod) => (
              <button
                key={mod.route}
                onClick={() => handleCreateContainer(mod.route, mod.label, mod.icon)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span>{mod.icon}</span>
                <span>{mod.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Container Slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
          {containers.map((c) => {
            const isActive = activeContainerId === c.id;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: sidebarCollapsed ? '0' : '8px',
                  padding: sidebarCollapsed ? '8px 0' : '6px 10px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                  border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  cursor: 'pointer',
                  justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                }}
                onClick={() => setActiveContainer(c.id)}
                title={c.name}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
                  {!sidebarCollapsed && (
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 600 : 400,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        maxWidth: '120px',
                      }}
                    >
                      {c.name}
                    </span>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeContainer(c.id);
                    }}
                    title="Cerrar contenedor"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: '2px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: Sidebar Collapse Toggle */}
      <div
        className="sidebar-footer"
        style={{
          marginTop: 'auto',
          padding: '12px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '8px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.125rem',
            borderRadius: 'var(--radius)',
            transition: 'color var(--transition)',
          }}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>
    </aside>
  );
}
