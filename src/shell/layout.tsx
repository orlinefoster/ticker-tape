import { useState, lazy, Suspense, type ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { ErrorBoundary } from '@/lib/errorBoundary';
import './styles.css';

const Dashboard = lazy(() => import('@/modules/dashboard').then((m) => ({ default: m.Dashboard })));
const TopDownModule = lazy(() => import('@/modules/top_down'));
const MarketChartModule = lazy(() => import('@/modules/chart'));
const CarteraModule = lazy(() => import('@/modules/cartera'));
const CarteraIolModule = lazy(() => import('@/modules/cartera_iol'));
const PortfolioModule = lazy(() => import('@/modules/portfolio'));
const SpyDcaModule = lazy(() => import('@/modules/spy_dca'));
const ProvidersModule = lazy(() => import('@/modules/providers'));
const IntermarketModule = lazy(() => import('@/modules/intermarket'));
const TopologyModule = lazy(() => import('@/modules/topology'));
const RelativePerfModule = lazy(() => import('@/modules/relative_perf'));
const BacktestingModule = lazy(() => import('@/modules/backtesting'));
const ElliottWaveModule = lazy(() => import('@/modules/elliott_wave'));
const MonitorModule = lazy(() => import('@/modules/monitor'));
const WikiModule = lazy(() => import('@/modules/wiki'));

interface ModuleEntry {
  name: string;
  component: ReactNode;
}

const modules: Record<string, ModuleEntry> = {
  '/': { name: 'Dashboard', component: <Dashboard /> },
  '/top-down': { name: 'Top-Down Engine', component: <TopDownModule /> },
  '/chart': { name: 'Gráfico de Mercado', component: <MarketChartModule /> },
  '/cartera': { name: 'Cartera Binance Spot', component: <CarteraModule /> },
  '/cartera-iol': { name: 'Cartera Argentina IOL', component: <CarteraIolModule /> },
  '/portfolio': { name: 'Carteras & Patrimonio', component: <PortfolioModule /> },
  '/spy-dca': { name: 'Plan SPY + Sectores (DCA)', component: <SpyDcaModule /> },
  '/providers': { name: 'Diagnóstico de Proveedores', component: <ProvidersModule /> },
  '/intermarket': { name: 'Intermarket', component: <IntermarketModule /> },
  '/topology': { name: 'Market Topology', component: <TopologyModule /> },
  '/relative-perf': { name: 'Alpha Rotation Radar', component: <RelativePerfModule /> },
  '/backtesting': { name: 'Backtesting Module', component: <BacktestingModule /> },
  '/elliott': { name: 'Elliott Wave', component: <ElliottWaveModule /> },
  '/monitor': { name: 'Monitor', component: <MonitorModule /> },
  '/wiki': { name: 'Wiki & Métodos', component: <WikiModule /> },
};

function ModuleLoadingFallback({ name }: { name: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Cargando módulo ${name}...`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        height: '100%',
        gap: '16px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span className="font-mono" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>
        INICIALIZANDO {name.toUpperCase()}...
      </span>
    </div>
  );
}

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
    renameContainer,
    updateContainerIcon,
    removeContainer,
  } = useUIStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const activeContainer = containers.find((c) => c.id === activeContainerId);
  const currentRoute = activeContainer ? activeContainer.moduleRoute : activeRoute;

  const entry = modules[currentRoute] ?? {
    name: 'Module not found',
    component: <ModulePlaceholder name="Module not found" />,
  };

  const AVAILABLE_ICONS = ['⚡', '🇦🇷', '📊', '💼', '📉', '🎯', '🧪', '👁️', '🌊', '📡', '📈', '🚀', '🤖', '🔮', '💎', '🛡️'];

  const handleStartEditingName = () => {
    if (activeContainer) {
      setEditingNameValue(activeContainer.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (activeContainer && editingNameValue.trim()) {
      renameContainer(activeContainer.id, editingNameValue.trim());
    }
    setIsEditingName(false);
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
                padding: '10px 18px',
                marginBottom: '16px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-card)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Icon button with popup picker */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    title="Cambiar icono de vista"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activeContainer.icon}
                  </button>

                  {showIconPicker && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '110%',
                        left: '0',
                        zIndex: 200,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '8px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}
                    >
                      {AVAILABLE_ICONS.map((ico) => (
                        <button
                          key={ico}
                          onClick={() => {
                            updateContainerIcon(activeContainer.id, ico);
                            setShowIconPicker(false);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-card-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Editable Container Name */}
                {isEditingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      autoFocus
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--accent)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text-bright)',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      onClick={handleStartEditingName}
                      title="Clic para renombrar vista personalizada"
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: 'var(--text-bright)',
                        cursor: 'pointer',
                        borderBottom: '1px dashed var(--border-subtle)',
                      }}
                    >
                      {activeContainer.name}
                    </span>
                    <button
                      onClick={handleStartEditingName}
                      title="Renombrar vista"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✏️
                    </button>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--accent-muted)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      Módulo Guardado
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Module switcher inside container */}
                <select
                  value={activeContainer.moduleRoute}
                  onChange={(e) => updateContainerModule(activeContainer.id, e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(modules).map(([route, mod]) => (
                    <option key={route} value={route}>
                      Módulo Base: {mod.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeContainer(activeContainer.id)}
                  title="Eliminar este módulo guardado"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(255, 82, 82, 0.4)',
                    backgroundColor: 'rgba(255, 82, 82, 0.1)',
                    color: '#FF5252',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 82, 82, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 82, 82, 0.1)')}
                >
                  ✕ Cerrar Vista
                </button>
              </div>
            </div>
          )}

          <ErrorBoundary key={activeContainer ? activeContainer.id : activeRoute}>
            <Suspense fallback={<ModuleLoadingFallback name={entry.name} />}>
              {entry.component}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
