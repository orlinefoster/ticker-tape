import { useState, useEffect } from 'react';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { FinancialChart, type ChartMarker } from '@/components/FinancialChart';
import type { CandlestickData, Time } from 'lightweight-charts';

interface WaveLabel {
  id?: number;
  symbol: string;
  timeframe: string;
  wave_degree: string;
  wave_label: string;
  start_date: string;
  end_date?: string;
  price_start?: number;
  price_end?: number;
  confidence: number;
  is_automatic: boolean;
  notes?: string;
}

export default function ElliottWaveModule() {
  const [symbol, setSymbol] = useState('SPY');
  const [waves, setWaves] = useState<WaveLabel[]>([]);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [symbol]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch bars for chart
      try {
        const fetchedBars = await commands.fetchMarketData(symbol, '2y');
        setBars(fetchedBars || []);
      } catch (err) {
        console.warn('Could not fetch market bars for chart:', err);
      }

      // 2. Load wave labels
      const labels = (await commands.loadWaveLabels(symbol)) as WaveLabel[];
      setWaves(labels || []);
    } catch (e) {
      setWaves([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCount() {
    setLoading(true);
    setError(null);
    try {
      const labels = (await commands.recountWaves(symbol)) as WaveLabel[];
      setWaves(labels || []);

      // Refresh bars
      const fetchedBars = await commands.fetchMarketData(symbol, '2y');
      setBars(fetchedBars || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const impulse = waves.filter((w) => ['1', '2', '3', '4', '5'].includes(w.wave_label));
  const corrective = waves.filter((w) => ['A', 'B', 'C'].includes(w.wave_label));
  const other = waves.filter((w) => !['1', '2', '3', '4', '5', 'A', 'B', 'C'].includes(w.wave_label));

  // Convert bars to Lightweight Charts candlestick format
  const chartData: CandlestickData<Time>[] = bars
    .map((b) => ({
      time: b.date as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    .sort((a, b) => (a.time > b.time ? 1 : -1));

  // Map waves into markers on chart
  const markers: ChartMarker[] = waves
    .filter((w) => w.start_date)
    .map((w) => {
      const isImpulse = ['1', '3', '5'].includes(w.wave_label);
      const isDip = ['2', '4', 'A', 'C'].includes(w.wave_label);
      return {
        time: w.start_date,
        position: isImpulse ? 'aboveBar' : isDip ? 'belowBar' : 'aboveBar',
        color: isImpulse ? '#4caf50' : '#ff9800',
        shape: isImpulse ? 'arrowDown' : 'arrowUp',
        text: `${w.wave_label} (${w.wave_degree})`,
      };
    });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Elliott Wave Theory 🌊</h2>
          <p style={styles.subtitle}>
            Conteo fractal automático de ondas de impulso (1-5) y corrección (A-C)
          </p>
        </div>
        <div style={styles.toolbar}>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={styles.select}
          >
            <option value="SPY">SPY (S&P 500)</option>
            <option value="QQQ">QQQ (Nasdaq 100)</option>
            <option value="BTC">BTC (Bitcoin)</option>
            <option value="GLD">GLD (Gold)</option>
            <option value="TLT">TLT (20Y Treasury)</option>
          </select>
          <button onClick={handleCount} disabled={loading} style={styles.button}>
            {loading ? 'Calculando...' : '🔄 Contar Ondas'}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Chart Visualization */}
      {chartData.length > 0 && (
        <div style={styles.chartSection}>
          <div style={styles.chartHeader}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Gráfico de Precios con Etiquetas Elliott ({symbol})
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {waves.length} etiquetas identificadas
            </span>
          </div>
          <FinancialChart
            type="candlestick"
            data={chartData}
            markers={markers}
            height={380}
          />
        </div>
      )}

      {waves.length === 0 && !loading && (
        <div style={styles.empty}>
          <p style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
            Sin etiquetas de ondas para {symbol}
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Haz clic en <strong>"Contar Ondas"</strong> para ejecutar el algoritmo de conteo sobre los últimos 2 años.
          </p>
        </div>
      )}

      {impulse.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🟢 Ondas Impulsivas (1-2-3-4-5)</h3>
          <WaveTable waves={impulse} />
        </div>
      )}

      {corrective.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🟠 Ondas Correctivas (A-B-C)</h3>
          <WaveTable waves={corrective} />
        </div>
      )}

      {other.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Otras Etiquetas</h3>
          <WaveTable waves={other} />
        </div>
      )}
    </div>
  );
}

function WaveTable({ waves }: { waves: WaveLabel[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Onda</th>
            <th style={styles.th}>Grado</th>
            <th style={styles.th}>Fecha Inicio</th>
            <th style={styles.th}>Fecha Fin</th>
            <th style={styles.th}>Precio Inicio</th>
            <th style={styles.th}>Precio Fin</th>
            <th style={styles.th}>Confianza</th>
          </tr>
        </thead>
        <tbody>
          {waves.map((w, i) => (
            <tr key={i} style={styles.tr}>
              <td style={styles.td}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: ['1', '3', '5'].includes(w.wave_label)
                      ? 'rgba(76, 175, 80, 0.15)'
                      : 'rgba(255, 152, 0, 0.15)',
                    color: ['1', '3', '5'].includes(w.wave_label) ? '#2e7d32' : '#e65100',
                    fontWeight: 700,
                  }}
                >
                  Onda {w.wave_label}
                </span>
              </td>
              <td style={styles.td}>{w.wave_degree}</td>
              <td style={styles.td}>{w.start_date}</td>
              <td style={styles.td}>{w.end_date || '—'}</td>
              <td style={styles.td}>{w.price_start != null ? `$${w.price_start.toFixed(2)}` : '—'}</td>
              <td style={styles.td}>{w.price_end != null ? `$${w.price_end.toFixed(2)}` : '—'}</td>
              <td style={styles.td}>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      w.confidence > 0.7
                        ? '#4caf50'
                        : w.confidence > 0.4
                        ? '#ff9800'
                        : '#f44336',
                  }}
                >
                  {(w.confidence * 100).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
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
  toolbar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  select: {
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  button: {
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    border: 'none',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity var(--transition)',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 'var(--radius)',
    marginBottom: '20px',
  },
  chartSection: {
    marginBottom: '24px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    border: '1px solid var(--border)',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  empty: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px dashed var(--border)',
    marginBottom: '20px',
  },
  section: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid var(--border)',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 16px',
    color: 'var(--text-primary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 12px',
    color: 'var(--text-primary)',
  },
};
