import { useUIStore } from '@/store/uiStore';

interface NavItem {
  route: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { route: '/', label: 'Dashboard', icon: '📊' },
  { route: '/intermarket', label: 'Intermarket', icon: '🔄' },
  { route: '/topology', label: 'Topology', icon: '🔗' },
  { route: '/backtesting', label: 'Backtesting', icon: '📈' },
  { route: '/elliott', label: 'Elliott Wave', icon: '🌊' },
  { route: '/portfolio', label: 'Portfolio', icon: '💼' },
  { route: '/monitor', label: 'Monitor', icon: '👁️' },
];

export function Sidebar() {
  const { sidebarCollapsed, activeRoute, toggleSidebar, setActiveRoute } = useUIStore();

  return (
    <aside
      className="sidebar"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        minWidth: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
      }}
    >
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = activeRoute === item.route;
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
                padding: sidebarCollapsed ? '12px 0' : '12px 16px',
                border: 'none',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                borderRadius: 'var(--radius)',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                transition: 'background var(--transition), color var(--transition)',
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

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
