import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { FinancialChart } from '@/components/FinancialChart';
import { StatCard } from '@/components/StatCard';
import type { CandlestickData, Time } from 'lightweight-charts';

export function Dashboard() {
  const { setActiveRoute } = useUIStore();
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loadingBars, setLoadingBars] = useState(false);

  // Ollama AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Quick Action feedback
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadSymbolData(selectedSymbol);
  }, [selectedSymbol]);

  const loadSymbolData = async (sym: string) => {
    setLoadingBars(true);
    try {
      const data = await commands.fetchMarketData(sym, '1y');
      setBars(data || []);
    } catch (err) {
      console.warn('Dashboard data fetch warning:', err);
    } finally {
      setLoadingBars(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const analysis = await commands.analyzeMarketAI(selectedSymbol);
      setAiAnalysis(analysis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(msg || 'No se pudo conectar a Ollama. Asegúrate de tener Ollama ejecutándose en localhost:11434.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    setActionFeedback(null);
    try {
      if (action === 'greet') {
        const res = await commands.greet('Trader');
        setActionFeedback(`✅ ${res}`);
      } else if (action === 'market-data') {
        const bars = await commands.fetchMarketData(selectedSymbol, '1y');
        setActionFeedback(`✅ ${bars.length} barras cargadas en caché para ${selectedSymbol}`);
      } else if (action === 'strategy') {
        const signals = await commands.runStrategy(selectedSymbol, 'ma-crossover', { fast: 50, slow: 200 });
        setActionFeedback(`✅ Estrategia ejecutada: ${signals.length} señales generadas`);
      } else if (action === 'backtest') {
        setActiveRoute('/backtesting');
      } else if (action === 'elliott') {
        setActiveRoute('/elliott');
      }
    } catch (e) {
      setActionFeedback(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const chartData: CandlestickData<Time>[] = bars
    .map((b) => ({
      time: b.date as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    .sort((a, b) => (a.time > b.time ? 1 : -1));

  return (
    <div className="dashboard" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Panel Principal 🎞️</h1>
          <p style={styles.subtitle}>
            Visión global del mercado, motor cuantitativo e inteligencia artificial local
          </p>
        </div>
        <div style={styles.statusBadge}>
          <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>🟢</span>
          <span style={styles.statusText}>Sistema Operativo</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <StatCard label="Activos Monitoreados" value="12" icon="📈" color="var(--accent)" />
        <StatCard label="Módulos Activos" value="6" icon="🧩" color="#4caf50" />
        <StatCard label="Estrategias Core" value="3" icon="⚙️" color="#2196f3" />
        <StatCard label="LLM Integrado" value="Ollama" icon="🤖" color="#9c27b0" />
      </div>

      {/* Main Grid: Chart + AI Assistant */}
      <div style={styles.mainGrid}>
        {/* Left Column: Live Chart Preview */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Gráfico de Mercado</h3>
              <p style={styles.cardSubtitle}>Datos históricos OHLCV con caché SQLite local</p>
            </div>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={styles.select}
            >
              <option value="SPY">SPY (S&P 500)</option>
              <option value="QQQ">QQQ (Nasdaq 100)</option>
              <option value="BTC">BTC (Bitcoin)</option>
              <option value="GLD">GLD (Oro)</option>
              <option value="TLT">TLT (Bonos 20Y)</option>
            </select>
          </div>

          {loadingBars ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <span>Cargando datos de {selectedSymbol}...</span>
            </div>
          ) : chartData.length > 0 ? (
            <FinancialChart type="candlestick" data={chartData} height={320} />
          ) : (
            <div style={styles.emptyChart}>
              <p>No hay datos cargados para {selectedSymbol}. Haz clic en Actualizar en Quick Actions.</p>
            </div>
          )}
        </div>

        {/* Right Column: Ollama AI Assistant */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Asistente AI (Ollama Local)</h3>
              <p style={styles.cardSubtitle}>Razonamiento y análisis de mercado en tu máquina</p>
            </div>
            <button
              onClick={handleRunAiAnalysis}
              disabled={aiLoading}
              style={styles.aiButton}
            >
              {aiLoading ? 'Analizando...' : '✨ Analizar'}
            </button>
          </div>

          {aiLoading && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <span>Consultando modelo local (Ollama)...</span>
            </div>
          )}

          {aiError && (
            <div style={styles.errorBox}>
              <strong>Aviso de Conexión:</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>{aiError}</p>
            </div>
          )}

          {aiAnalysis && !aiLoading && (
            <div style={styles.aiResult}>
              <div style={styles.aiMarkdown}>{aiAnalysis}</div>
            </div>
          )}

          {!aiAnalysis && !aiLoading && !aiError && (
            <div style={styles.emptyAi}>
              <span style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</span>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                Análisis Contextual con LLM
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Haz clic en "Analizar" para que el modelo local evalúe la acción del precio de {selectedSymbol}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div style={styles.feedbackBanner}>
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} style={styles.closeFeedbackBtn}>
            ×
          </button>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Acciones Rápidas del Motor
        </h3>
        <div style={styles.quickActionsGrid}>
          {[
            { id: 'greet', label: 'Test IPC Core', desc: 'Verificar canal de comunicación Tauri' },
            { id: 'market-data', label: 'Sincronizar Cache', desc: `Descargar barras de ${selectedSymbol}` },
            { id: 'strategy', label: 'Evaluar Señales', desc: 'Ejecutar MA Crossover en Rust' },
            { id: 'backtest', label: 'Ir a Backtest', desc: 'Simulación completa de estrategias' },
            { id: 'elliott', label: 'Conteo Elliott', desc: 'Explorar ondas fractales' },
          ].map((cmd) => (
            <div
              key={cmd.id}
              onClick={() => handleQuickAction(cmd.id)}
              style={styles.actionCard}
            >
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                {cmd.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {cmd.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid #4caf50',
  },
  statusText: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#4caf50',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: '20px',
  },
  card: {
    padding: '20px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  cardSubtitle: {
    margin: '4px 0 0',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  select: {
    padding: '6px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  aiButton: {
    padding: '8px 16px',
    backgroundColor: '#9c27b0',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '40px 20px',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyChart: {
    height: '320px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  emptyAi: {
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '20px',
  },
  aiResult: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '14px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  aiMarkdown: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  feedbackBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  closeFeedbackBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.25rem',
    cursor: 'pointer',
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  actionCard: {
    padding: '16px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, border-color 0.15s ease',
  },
};
