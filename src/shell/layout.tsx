import { type ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { Dashboard } from '@/modules/dashboard';
import { ErrorBoundary } from '@/lib/errorBoundary';
import './styles.css';

interface ModuleEntry {
  name: string;
  component: ReactNode;
}

const modules: Record<string, ModuleEntry> = {
  '/': { name: 'Dashboard', component: <Dashboard /> },
  '/backtesting': { name: 'Backtesting Module', component: <ModulePlaceholder name="Backtesting Module" /> },
  '/elliott': { name: 'Elliott Wave', component: <ModulePlaceholder name="Elliott Wave" /> },
  '/portfolio': { name: 'Portfolio', component: <ModulePlaceholder name="Portfolio" /> },
  '/monitor': { name: 'Monitor', component: <ModulePlaceholder name="Monitor" /> },
};

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px dashed var(--border)',
        color: 'var(--text-secondary)',
        fontSize: '1.125rem',
      }}
    >
      {name}
    </div>
  );
}

export function Shell() {
  const { activeRoute } = useUIStore();
  const entry = modules[activeRoute] ?? {
    name: 'Module not found',
    component: <ModulePlaceholder name="Module not found" />,
  };

  return (
    <div
      className="shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <TopBar />
      <div
        className="shell-body"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Sidebar />
        <main
          className="content-area"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
            backgroundColor: 'var(--bg-primary)',
            transition: 'margin-left var(--transition)',
          }}
        >
          <ErrorBoundary key={activeRoute}>
            {entry.component}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
