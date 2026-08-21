import { useState } from 'react';
import { commands, type BacktestResult } from '@/lib/tauri';
import { FinancialChart } from '@/components/FinancialChart';
import { StatCard } from '@/components/StatCard';
import type { LineData, Time } from 'lightweight-charts';

type StrategyType = 'ma-crossover' | 'bollinger-bands' | 'rsi';

export default function BacktestingModule() {
  const [symbol, setSymbol] = useState('SPY');
  const [strategy, setStrategy] = useState<StrategyType>('ma-crossover');
  const [initialCapital, setInitialCapital] = useState(100000);

  // Strategy specific parameters
  const [maFast, setMaFast] = useState(50);
  const [maSlow, setMaSlow] = useState(200);

  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStdDev, setBbStdDev] = useState(2.0);

  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);

    let params: Record<string, unknown> = {};
    if (strategy === 'ma-crossover') {
      params = { fast: maFast, slow: maSlow };
    } else if (strategy === 'bollinger-bands') {
      params = { period: bbPeriod, stddev: bbStdDev };
    } else if (strategy === 'rsi') {
      params = { period: rsiPeriod, overbought: rsiOverbought, oversold: rsiOversold };
    }

    try {
      // First ensure market data is available in DB
      try {
        await commands.fetchMarketData(symbol, '2y');
      } catch (fetchErr) {
        console.warn('Market data fetch warning:', fetchErr);
      }

      const backtestRes = await commands.runBacktest(symbol, strategy, params);
      setResult(backtestRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Error al ejecutar el backtest.');
    } finally {
      setLoading(false);
    }
  };

  // Build Equity Curve for FinancialChart
  const equityCurveData: LineData<Time>[] = result && result.equity_curve && result.equity_curve.length > 0
    ? result.equity_curve.map((val, idx) => {
        // Generate pseudo date sequence or index date
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - (result.equity_curve.length - idx));
        const dateStr = baseDate.toISOString().split('T')[0];
        return {
          time: dateStr as Time,
          value: val,
        };
      })
    : [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Motor de Backtesting 📈</h2>
          <p style={styles.subtitle}>
            Simulación cuantitativa y evaluación histórica de rendimiento de estrategias
          </p>
        </div>
      </div>

      {/* Strategy & Parameters Panel */}
      <div style={styles.configCard}>
        <div style={styles.configRow}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Símbolo</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={styles.select}
            >
              <option value="SPY">SPY (S&P 500 ETF)</option>
              <option value="QQQ">QQQ (Nasdaq 100 ETF)</option>
              <option value="BTC">BTC (Bitcoin)</option>
              <option value="GLD">GLD (Gold ETF)</option>
              <option value="TLT">TLT (20Y Treasury)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Estrategia</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyType)}
              style={styles.select}
            >
              <option value="ma-crossover">Media Móvil (MA Crossover)</option>
              <option value="bollinger-bands">Bandas de Bollinger (Mean Reversion)</option>
              <option value="rsi">RSI (Oscilador Sobrecompra/Sobreventa)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Capital Inicial ($)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              style={styles.input}
            />
          </div>
        </div>

        {/* Dynamic Parameters */}
        <div style={styles.paramSection}>
          <span style={styles.paramSectionTitle}>Parámetros de la Estrategia:</span>
          <div style={styles.paramGrid}>
            {strategy === 'ma-crossover' && (
              <>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>MA Rápida (Periodos):</label>
                  <input
                    type="number"
                    value={maFast}
                    onChange={(e) => setMaFast(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>MA Lenta (Periodos):</label>
                  <input
                    type="number"
                    value={maSlow}
                    onChange={(e) => setMaSlow(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
              </>
            )}

            {strategy === 'bollinger-bands' && (
              <>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>Periodo SMA:</label>
                  <input
                    type="number"
                    value={bbPeriod}
                    onChange={(e) => setBbPeriod(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>Desviación Estándar (k):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bbStdDev}
                    onChange={(e) => setBbStdDev(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
              </>
            )}

            {strategy === 'rsi' && (
              <>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>Periodo RSI:</label>
                  <input
                    type="number"
                    value={rsiPeriod}
                    onChange={(e) => setRsiPeriod(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>Umbral Sobrecompra:</label>
                  <input
                    type="number"
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
                <div style={styles.paramItem}>
                  <label style={styles.paramLabel}>Umbral Sobreventa:</label>
                  <input
                    type="number"
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(Number(e.target.value))}
                    style={styles.paramInput}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={loading}
          style={styles.runButton}
        >
          {loading ? 'Simulando Estrategia...' : '🚀 Ejecutar Backtest'}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong>Error al ejecutar backtest</strong>
            <p style={{ margin: '4px 0 0' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div style={styles.resultsContainer}>
          {/* KPI Metrics */}
          <div style={styles.statsGrid}>
            <StatCard
              label="Retorno Total"
              value={`${(result.total_return * 100).toFixed(2)}%`}
              changeType={result.total_return >= 0 ? 'positive' : 'negative'}
              color={result.total_return >= 0 ? '#4caf50' : '#f44336'}
              icon="💰"
            />
            <StatCard
              label="Retorno Anualizado"
              value={`${(result.annualized_return * 100).toFixed(2)}%`}
              changeType={result.annualized_return >= 0 ? 'positive' : 'negative'}
              color={result.annualized_return >= 0 ? '#4caf50' : '#f44336'}
              icon="📅"
            />
            <StatCard
              label="Sharpe Ratio"
              value={result.sharpe.toFixed(2)}
              color={result.sharpe >= 1.0 ? '#4caf50' : result.sharpe >= 0.5 ? '#ff9800' : 'var(--text-primary)'}
              icon="⚖️"
            />
            <StatCard
              label="Máximo Drawdown"
              value={`${(result.max_drawdown * 100).toFixed(2)}%`}
              color="#f44336"
              icon="📉"
            />
            <StatCard
              label="Tasa de Acierto (Win Rate)"
              value={`${(result.win_rate * 100).toFixed(1)}%`}
              color={result.win_rate >= 0.5 ? '#4caf50' : '#ff9800'}
              icon="🎯"
            />
            <StatCard
              label="Total Operaciones"
              value={result.num_trades}
              icon="🔄"
              color="var(--accent)"
            />
          </div>

          {/* Equity Curve Chart */}
          {equityCurveData.length > 0 && (
            <div style={styles.chartCard}>
              <div style={styles.chartTitleRow}>
                <h3 style={styles.chartTitle}>Curva de Balance (Equity Curve)</h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Capital final: ${(initialCapital * (1 + result.total_return)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <FinancialChart
                type="area"
                data={equityCurveData}
                height={350}
              />
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div style={styles.emptyState}>
          <span style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</span>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Listo para Simular</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '450px' }}>
            Selecciona el símbolo, configura los parámetros de la estrategia y haz clic en "Ejecutar Backtest" para analizar las métricas de rendimiento y riesgo.
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: 1100,
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
    fontSize: '0.875rem',
  },
  configCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    marginBottom: '24px',
  },
  configRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  select: {
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  paramSection: {
    padding: '16px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    marginBottom: '16px',
  },
  paramSectionTitle: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  paramGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  paramItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  paramLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
  paramInput: {
    width: '80px',
    padding: '6px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    textAlign: 'center',
  },
  runButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity var(--transition)',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 'var(--radius)',
    marginBottom: '24px',
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  chartCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  chartTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  chartTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px dashed var(--border)',
    textAlign: 'center',
  },
};
