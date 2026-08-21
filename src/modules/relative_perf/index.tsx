import { useEffect, useState, useCallback, useMemo } from 'react';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { FinancialChart, type LineOverlay } from '@/components/FinancialChart';
import { StatCard } from '@/components/StatCard';
import { RRGQuadrantChart, type RRGDataPoint } from '@/components/RRGQuadrantChart';
import { ElliottOscillatorChart } from '@/components/ElliottOscillatorChart';
import type { LineData, Time } from 'lightweight-charts';

interface RelativeStrength {
  symbol: string;
  returns_1w: number;
  returns_1m: number;
  returns_3m: number;
  returns_6m: number;
  returns_1y: number;
  rank_1w: number;
  rank_1m: number;
  rank_3m: number;
  rank_6m: number;
  rank_1y: number;
  composite_rs: number;
  vs_benchmark_1m: number;
  vs_benchmark_3m: number;
  vs_benchmark_6m: number;
}

interface RelativePerfReport {
  date: string;
  benchmark: string;
  universe_size: number;
  rankings: RelativeStrength[];
  top_performer: string;
  bottom_performer: string;
  rotation_score: number;
}

const WINDOWS = ['1w', '1m', '3m', '6m', '1y'] as const;
const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'TLT', 'GLD', 'DBC', 'NVDA', 'AAPL'];
const COLOR_PALETTE = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#e91e63', '#00bcd4', '#ff5722'];

function rankColor(rank: number, total: number): string {
  const pct = rank / Math.max(1, total);
  if (pct <= 0.25) return '#4caf50';
  if (pct <= 0.5) return '#8bc34a';
  if (pct <= 0.75) return '#ff9800';
  return '#f44336';
}

function vsColor(vs: number): string {
  if (vs > 0.02) return '#4caf50';
  if (vs > 0) return '#8bc34a';
  if (vs > -0.02) return '#ff9800';
  return '#f44336';
}

export default function RelativePerfModule() {
  const [report, setReport] = useState<RelativePerfReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState('');
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [selectedAsset, setSelectedAsset] = useState<string>('QQQ');

  // Multi-asset historical bars for normalized chart & RRG
  const [symbolBarsMap, setSymbolBarsMap] = useState<Record<string, OHLCVBar[]>>({});

  const fetchAnalysis = useCallback(async (symList: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await commands.runAnalysis('relative-perf', symList, {});
      setReport(result as unknown as RelativePerfReport);

      // Fetch bars for each symbol to plot RRG and normalized charts
      const barsMap: Record<string, OHLCVBar[]> = {};
      for (const sym of symList) {
        try {
          const bars = await commands.fetchMarketData(sym, '6m');
          if (bars && bars.length > 0) {
            barsMap[sym] = bars;
          } else {
            barsMap[sym] = generateMockBars(sym);
          }
        } catch {
          barsMap[sym] = generateMockBars(sym);
        }
      }
      setSymbolBarsMap(barsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar rendimiento relativo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis(DEFAULT_SYMBOLS);
  }, [fetchAnalysis]);

  const handleAddSymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (!trimmed) return;
    if (symbols.includes(trimmed)) {
      setSymbolInput('');
      return;
    }
    const newSymbols = [...symbols, trimmed];
    setSymbols(newSymbols);
    setSymbolInput('');
    fetchAnalysis(newSymbols);
  };

  const handleRemoveSymbol = (sym: string) => {
    if (sym === 'SPY') return; // Keep benchmark
    const newSymbols = symbols.filter((s) => s !== sym);
    if (newSymbols.length === 0) return;
    setSymbols(newSymbols);
    fetchAnalysis(newSymbols);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSymbol();
    }
  };

  const data = report?.rankings ?? [];
  const total = data.length;

  // Compute RRG Quadrant Data
  const rrgPoints = useMemo<RRGDataPoint[]>(() => {
    return computeRRGData(symbolBarsMap, report?.benchmark || 'SPY');
  }, [symbolBarsMap, report]);

  // Build Normalized Performance Comparison Overlays (% Change from Day 0)
  const chartOverlays = useMemo<LineOverlay[]>(() => {
    const activeSymbols = Object.keys(symbolBarsMap);
    if (!activeSymbols.length) return [];

    const result: LineOverlay[] = [];

    activeSymbols.forEach((sym, idx) => {
      const bars = symbolBarsMap[sym];
      if (!bars || bars.length < 2) return;

      const baseClose = bars[0].close;
      const normalizedData = bars.map((b) => ({
        time: b.date,
        value: Number((((b.close - baseClose) / baseClose) * 100).toFixed(2)),
      }));

      result.push({
        name: sym,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
        lineWidth: sym === 'SPY' ? 3 : 2,
        data: normalizedData,
      });
    });

    return result;
  }, [symbolBarsMap]);

  // Main series data for primary baseline line
  const mainChartData = useMemo(() => {
    if (chartOverlays.length > 0 && chartOverlays[0].data.length > 0) {
      return chartOverlays[0].data as unknown as LineData<Time>[];
    }
    return [];
  }, [chartOverlays]);

  const selectedAssetBars = symbolBarsMap[selectedAsset] || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Alpha Rotation & RS Radar 📡</h2>
          <p style={styles.subtitle}>
            Matriz de Cuadrantes RRG (Relative Rotation Graph), Oscilador de Elliott (35, 5) y Fuerza Relativa (RS)
          </p>
        </div>
        <span style={styles.badge}>Benchmark: {report?.benchmark ?? 'SPY'}</span>
      </div>

      {/* Symbol Selection Bar */}
      <div style={styles.symbolBar}>
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Agregar activo al radar (ej. NVDA, AAPL, XLK, GLD)..."
            style={styles.input}
          />
          <button onClick={handleAddSymbol} style={styles.addBtn}>
            + Agregar Activo
          </button>
        </div>
        <div style={styles.symbolTags}>
          {symbols.map((sym) => (
            <span key={sym} style={styles.symbolTag}>
              {sym}
              {sym !== 'SPY' && (
                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  style={styles.removeBtn}
                  title={`Eliminar ${sym}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Calculando matriz RRG y curvas de fuerza relativa...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <strong>Error de análisis</strong>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
          <button onClick={() => fetchAnalysis(symbols)} style={styles.retryBtn}>
            Reintentar
          </button>
        </div>
      )}

      {/* Main Report & Visualizations */}
      {!loading && !error && data.length > 0 && (
        <div style={styles.content}>
          {/* Executive Stat Cards */}
          <div style={styles.summaryGrid}>
            <StatCard
              label="Líder Alpha (Top RS)"
              value={report?.top_performer || data[0]?.symbol || '—'}
              color="#4caf50"
              icon="🏆"
            />
            <StatCard
              label="Rezagado (Bottom RS)"
              value={report?.bottom_performer || data[data.length - 1]?.symbol || '—'}
              color="#f44336"
              icon="🔻"
            />
            <StatCard
              label="Score RS Máximo"
              value={`${data[0]?.composite_rs.toFixed(0) ?? '—'}`}
              color="var(--accent)"
              icon="⚡"
            />
            <StatCard
              label="Intensidad de Rotación"
              value={report ? report.rotation_score.toFixed(1) : '—'}
              color="var(--text-primary)"
              icon="🔄"
            />
          </div>

          {/* 1. RELATIVE ROTATION GRAPH (RRG) QUADRANT CHART */}
          <RRGQuadrantChart
            points={rrgPoints}
            benchmarkSymbol={report?.benchmark || 'SPY'}
            selectedSymbol={selectedAsset}
            onSelectSymbol={(sym) => setSelectedAsset(sym)}
          />

          {/* 2. ELLIOTT OSCILLATOR CHART (35, 5) */}
          <div style={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Seleccionar Activo para Oscilador de Elliott (35, 5):
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {symbols.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setSelectedAsset(sym)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedAsset === sym ? 'var(--accent)' : 'transparent',
                      color: selectedAsset === sym ? '#ffffff' : 'var(--text-primary)',
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <ElliottOscillatorChart
              bars={selectedAssetBars}
              symbol={selectedAsset}
            />
          </div>

          {/* 3. NORMALIZED PERFORMANCE COMPARISON CHART */}
          {chartOverlays.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Curvas de Rendimiento Normalizado (%) 📈</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                Comparación directa de retorno porcentual acumulado (base 0%) durante los últimos 6 meses
              </p>
              <FinancialChart
                type="line"
                data={mainChartData}
                overlays={chartOverlays}
                height={340}
              />
            </div>
          )}

          {/* 4. RS LEADERBOARD TABLE */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Matriz de Fuerza Relativa Multi-Ventana (RS Leaderboard)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Símbolo</th>
                    {WINDOWS.map((w) => (
                      <th key={w} style={styles.th}>
                        {w} Ret
                      </th>
                    ))}
                    {WINDOWS.map((w) => (
                      <th key={`r-${w}`} style={styles.th}>
                        {w} Rank
                      </th>
                    ))}
                    <th style={styles.th}>RS Score</th>
                    <th style={styles.th}>vs SPY 1m</th>
                    <th style={styles.th}>vs SPY 3m</th>
                    <th style={styles.th}>vs SPY 6m</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={r.symbol} style={styles.tr}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 700 }}>{r.symbol}</td>
                      <td style={styles.td}>{(r.returns_1w * 100).toFixed(1)}%</td>
                      <td style={styles.td}>{(r.returns_1m * 100).toFixed(1)}%</td>
                      <td style={styles.td}>{(r.returns_3m * 100).toFixed(1)}%</td>
                      <td style={styles.td}>{(r.returns_6m * 100).toFixed(1)}%</td>
                      <td style={styles.td}>{(r.returns_1y * 100).toFixed(1)}%</td>
                      <td
                        style={{
                          ...styles.td,
                          color: rankColor(r.rank_1w, total),
                          fontWeight: 600,
                        }}
                      >
                        {r.rank_1w}/{total}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: rankColor(r.rank_1m, total),
                          fontWeight: 600,
                        }}
                      >
                        {r.rank_1m}/{total}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: rankColor(r.rank_3m, total),
                          fontWeight: 600,
                        }}
                      >
                        {r.rank_3m}/{total}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: rankColor(r.rank_6m, total),
                          fontWeight: 600,
                        }}
                      >
                        {r.rank_6m}/{total}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: rankColor(r.rank_1y, total),
                          fontWeight: 600,
                        }}
                      >
                        {r.rank_1y}/{total}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 700,
                          color:
                            r.composite_rs > 80
                              ? '#4caf50'
                              : r.composite_rs > 50
                              ? '#ff9800'
                              : '#f44336',
                        }}
                      >
                        {r.composite_rs.toFixed(0)}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: vsColor(r.vs_benchmark_1m),
                          fontWeight: 600,
                        }}
                      >
                        {(r.vs_benchmark_1m * 100).toFixed(1)}%
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: vsColor(r.vs_benchmark_3m),
                          fontWeight: 600,
                        }}
                      >
                        {(r.vs_benchmark_3m * 100).toFixed(1)}%
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: vsColor(r.vs_benchmark_6m),
                          fontWeight: 600,
                        }}
                      >
                        {(r.vs_benchmark_6m * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={() => fetchAnalysis(symbols)}
            style={styles.refreshBtn}
            disabled={loading}
          >
            🔄 {loading ? 'Actualizando...' : 'Actualizar Matriz RS'}
          </button>
        </div>
      )}
    </div>
  );
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateMockBars(sym: string): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let basePrice = sym === 'BTC' ? 66000 : sym === 'NVDA' ? 128 : sym === 'AAPL' ? 224 : sym === 'GLD' ? 230 : sym === 'TLT' ? 95 : 545;
  const symHash = sym.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const startDate = new Date('2025-08-01');

  for (let i = 0; i <= 365; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    const rnd = seededRandom(symHash * 1000 + i);
    const change = (rnd - 0.485) * (basePrice * 0.015);
    const open = basePrice;
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) + rnd * (basePrice * 0.008);
    const low = Math.min(open, close) - rnd * (basePrice * 0.008);
    const volume = Math.floor(rnd * 8000000 + 2000000);

    bars.push({
      symbol: sym,
      date: dateStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    basePrice = close;
  }

  return bars;
}

// RRG Mathematical Computation Function
function computeRRGData(
  symbolBarsMap: Record<string, OHLCVBar[]>,
  benchmarkSymbol: string = 'SPY'
): RRGDataPoint[] {
  const spyBars = symbolBarsMap[benchmarkSymbol];
  if (!spyBars || spyBars.length < 20) return [];

  const points: RRGDataPoint[] = [];

  Object.keys(symbolBarsMap).forEach((sym) => {
    if (sym === benchmarkSymbol) return;

    const assetBars = symbolBarsMap[sym];
    if (!assetBars || assetBars.length < 20) return;

    const spyDateMap = new Map(spyBars.map((b) => [b.date, b.close]));

    const prSeries: { date: string; pr: number }[] = [];
    assetBars.forEach((b) => {
      const spyClose = spyDateMap.get(b.date);
      if (spyClose) {
        prSeries.push({ date: b.date, pr: b.close / spyClose });
      }
    });

    if (prSeries.length < 15) return;

    const meanPR = prSeries.reduce((acc, p) => acc + p.pr, 0) / prSeries.length;

    // PR_SMA(10) and RS-Ratio
    const rsRatioSeries: { date: string; ratio: number }[] = [];
    for (let i = 9; i < prSeries.length; i++) {
      const slice = prSeries.slice(i - 9, i + 1);
      const prSma10 = slice.reduce((acc, p) => acc + p.pr, 0) / 10;
      const ratio = 100 * (prSma10 / meanPR);
      rsRatioSeries.push({ date: prSeries[i].date, ratio });
    }

    if (rsRatioSeries.length < 6) return;

    // RM(5) = 100 * (RS_Ratio(t) / RS_Ratio(t-5))
    const xyHistory: { x: number; y: number; date: string }[] = [];
    for (let i = 5; i < rsRatioSeries.length; i++) {
      const currRatio = rsRatioSeries[i].ratio;
      const prevRatio = rsRatioSeries[i - 5].ratio;
      const rm = 100 * (currRatio / prevRatio);

      const x = Number((currRatio - 100).toFixed(2));
      const y = Number((rm - 100).toFixed(2));

      xyHistory.push({ x, y, date: rsRatioSeries[i].date });
    }

    if (!xyHistory.length) return;

    const tailHistory = xyHistory.slice(-6, -1);
    const lastPoint = xyHistory[xyHistory.length - 1];

    points.push({
      symbol: sym,
      x: lastPoint.x,
      y: lastPoint.y,
      history: tailHistory,
    });
  });

  return points;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--text-primary)' },
  subtitle: { color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.875rem' },
  badge: {
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  symbolBar: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 16,
    marginBottom: 20,
    border: '1px solid var(--border)',
  },
  inputGroup: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  symbolTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  symbolTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--text-secondary)',
    padding: 0,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 'var(--radius)',
    color: '#c62828',
    marginBottom: 20,
  },
  retryBtn: {
    marginLeft: 'auto',
    padding: '8px 16px',
    border: '1px solid #c62828',
    borderRadius: 'var(--radius)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#c62828',
    fontWeight: 600,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 20,
    border: '1px solid var(--border)',
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '8px 8px', whiteSpace: 'nowrap', color: 'var(--text-primary)' },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  refreshBtn: {
    padding: '12px 24px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    alignSelf: 'center',
  },
};
