import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';

interface NavItem {
  route: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Visión General',
    items: [
      { route: '/', label: 'Torre de Control', icon: '📊' },
      { route: '/portfolio', label: 'Carteras & Patrimonio', icon: '💼' },
    ],
  },
  {
    title: 'Inteligencia de Mercado',
    items: [
      { route: '/top-down', label: 'Top-Down Engine', icon: '🎯' },
      { route: '/chart', label: 'Gráfico Técnico', icon: '📉' },
      { route: '/intermarket', label: 'Ciclo Intermarket', icon: '🔄' },
      { route: '/topology', label: 'Topología & Regímenes', icon: '🔗' },
      { route: '/relative-perf', label: 'Alpha Rotation', icon: '📡' },
      { route: '/elliott', label: 'Elliott Wave', icon: '🌊' },
    ],
  },
  {
    title: 'Sistemas & Validación',
    items: [
      { route: '/backtesting', label: 'Backtesting', icon: '📈' },
      { route: '/providers', label: 'Proveedores & Sync', icon: '🔌' },
      { route: '/monitor', label: 'Monitor de Sistema', icon: '👁️' },
    ],
  },
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

  const allItems = navGroups.flatMap((g) => g.items);

  return (
    <aside
      className="sidebar"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        minWidth: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width var(--transition)',
        userSelect: 'none',
      }}
    >
      {/* Navigation Groups */}
      <nav
        className="sidebar-nav"
        style={{
          padding: '12px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {navGroups.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {!sidebarCollapsed && (
              <div
                style={{
                  padding: '4px 10px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                }}
              >
                {group.title}
              </div>
            )}

            {group.items.map((item) => {
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
                    gap: sidebarCollapsed ? '0' : '10px',
                    width: '100%',
                    padding: sidebarCollapsed ? '10px 0' : '7px 10px',
                    border: 'none',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    backgroundColor: isActive ? 'var(--bg-surface-card)' : 'transparent',
                    color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all var(--transition-fast)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div style={{ margin: '4px 10px', borderTop: '1px solid var(--border-subtle)' }} />

      {/* Lower Nav Section: Custom Saved Views */}
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          position: 'relative',
        }}
      >
        {!sidebarCollapsed && (
          <div
            style={{
              padding: '2px 6px',
              fontSize: '0.625rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
            }}
          >
            <span>Vistas 16:9</span>
            {containers.length > 0 && (
              <span
                style={{
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  backgroundColor: 'var(--bg-surface-card)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                }}
              >
                {containers.length}
              </span>
            )}
          </div>
        )}

        {/* Action Button: "+ Nueva Vista" */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Guardar nueva pestaña modular (+)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: sidebarCollapsed ? '0' : '6px',
            width: '100%',
            padding: sidebarCollapsed ? '8px 0' : '5px 8px',
            border: '1px dashed var(--border)',
            background: showPicker ? 'var(--bg-surface-card)' : 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            fontWeight: 500,
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            if (!showPicker) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>+</span>
          {!sidebarCollapsed && <span>Pestaña Modular</span>}
        </button>

        {/* Dropdown popup picker */}
        {showPicker && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '8px',
              right: '8px',
              backgroundColor: 'var(--bg-surface-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow)',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                padding: '3px 6px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '2px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}
            >
              Seleccionar Módulo:
            </div>
            {allItems.map((mod) => (
              <button
                key={mod.route}
                onClick={() => handleCreateContainer(mod.route, mod.label, mod.icon)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  textAlign: 'left',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span>{mod.icon}</span>
                <span>{mod.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Container Slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '150px', overflowY: 'auto' }}>
          {containers.map((c) => {
            const isActive = activeContainerId === c.id;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: sidebarCollapsed ? '0' : '6px',
                  padding: sidebarCollapsed ? '6px 0' : '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--bg-surface-card)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  cursor: 'pointer',
                  justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setActiveContainer(c.id)}
                title={c.name}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.9rem' }}>{c.icon}</span>
                  {!sidebarCollapsed && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)',
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
                    title="Cerrar vista"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      padding: '1px 3px',
                      borderRadius: '2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-bearish)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
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
          padding: '8px 10px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '6px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-bright)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>
    </aside>
  );
}
