import { type ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { Dashboard } from '@/modules/dashboard';
import IntermarketModule from '@/modules/intermarket';
import TopologyModule from '@/modules/topology';
import ElliottWaveModule from '@/modules/elliott_wave';
import RelativePerfModule from '@/modules/relative_perf';
import BacktestingModule from '@/modules/backtesting';
import PortfolioModule from '@/modules/portfolio';
import CarteraModule from '@/modules/cartera';
import MonitorModule from '@/modules/monitor';
import MarketChartModule from '@/modules/chart';
import ProvidersModule from '@/modules/providers';
import { ErrorBoundary } from '@/lib/errorBoundary';
import './styles.css';

interface ModuleEntry {
  name: string;
  component: ReactNode;
}

const modules: Record<string, ModuleEntry> = {
  '/': { name: 'Dashboard', component: <Dashboard /> },
  '/chart': { name: 'Gráfico de Mercado', component: <MarketChartModule /> },
  '/cartera': { name: 'Cartera Binance', component: <CarteraModule /> },
  '/providers': { name: 'Diagnóstico de Proveedores', component: <ProvidersModule /> },
  '/intermarket': { name: 'Intermarket', component: <IntermarketModule /> },
  '/topology': { name: 'Market Topology', component: <TopologyModule /> },
  '/relative-perf': { name: 'Alpha Rotation Radar', component: <RelativePerfModule /> },
  '/backtesting': { name: 'Backtesting Module', component: <BacktestingModule /> },
  '/elliott': { name: 'Elliott Wave', component: <ElliottWaveModule /> },
  '/portfolio': { name: 'Portfolio Multi-Activos', component: <PortfolioModule /> },
  '/monitor': { name: 'Monitor', component: <MonitorModule /> },
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
  const {
    activeRoute,
    containers,
    activeContainerId,
    updateContainerModule,
    removeContainer,
  } = useUIStore();

  const activeContainer = containers.find((c) => c.id === activeContainerId);
  const currentRoute = activeContainer ? activeContainer.moduleRoute : activeRoute;

  const entry = modules[currentRoute] ?? {
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
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Container Header Banner when displaying an active Container slot */}
          {activeContainer && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                marginBottom: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.25rem' }}>{activeContainer.icon}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    {activeContainer.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    (Vista Desplegada)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Module switcher inside container */}
                <select
                  value={activeContainer.moduleRoute}
                  onChange={(e) => updateContainerModule(activeContainer.id, e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(modules).map(([route, mod]) => (
                    <option key={route} value={route}>
                      Módulo: {mod.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeContainer(activeContainer.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #f44336',
                    backgroundColor: 'transparent',
                    color: '#f44336',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar Vista
                </button>
              </div>
            </div>
          )}

          <ErrorBoundary key={activeContainer ? activeContainer.id : activeRoute}>
            {entry.component}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
