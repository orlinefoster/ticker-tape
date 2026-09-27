import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { FinancialChart, type LineOverlay } from '@/components/FinancialChart';
import { StatCard } from '@/components/StatCard';
import { RRGQuadrantChart, type RRGDataPoint, type RRGQuadrant } from '@/components/RRGQuadrantChart';
import { ElliottOscillatorChart } from '@/components/ElliottOscillatorChart';
import { RSHeatmapMatrix } from './components/RSHeatmapMatrix';
import type { CandlestickData, LineData, Time } from 'lightweight-charts';

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
  missing_symbols?: string[];
}

export type PresetMode = 'tradfi' | 'crypto' | 'custom';

export interface MarketPreset {
  id: PresetMode;
  name: string;
  icon: string;
  badge: string;
  benchmark: string;
  symbols: string[];
  description: string;
}

export const MARKET_PRESETS: Record<PresetMode, MarketPreset> = {
  tradfi: {
    id: 'tradfi',
    name: 'TradFi / US Sectors',
    icon: '🏛️',
    badge: 'SPY Benchmark',
    benchmark: 'SPY',
    symbols: ['SPY', 'QQQ', 'TLT', 'GLD', 'DBC', 'NVDA', 'AAPL'],
    description: 'Acciones, ETFs sectoriales y materias primas de EE.UU. referenciados contra el S&P 500 (SPY).',
  },
  crypto: {
    id: 'crypto',
    name: 'Crypto / Altcoins',
    icon: '⚡',
    badge: 'BTC Benchmark',
    benchmark: 'BTC',
    symbols: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'LINK'],
    description: 'Ecosistema de criptomonedas y altcoins de alta capitalización 24/7 comparadas contra Bitcoin (BTC).',
  },
  custom: {
    id: 'custom',
    name: 'Personalizado',
    icon: '⚙️',
    badge: 'Libre elección',
    benchmark: 'SPY',
    symbols: ['SPY', 'QQQ', 'TLT', 'GLD', 'DBC'],
    description: 'Universo y benchmark a medida definidos libremente por el operador.',
  },
};

const COLOR_PALETTE = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#e91e63', '#00bcd4', '#ff5722', '#795548', '#00e676'];

export default function RelativePerfModule() {
  const [activePreset, setActivePreset] = useState<PresetMode>('tradfi');
  const [benchmark, setBenchmark] = useState<string>('SPY');
  const [symbols, setSymbols] = useState<string[]>(MARKET_PRESETS.tradfi.symbols);
  const [selectedAsset, setSelectedAsset] = useState<string>('QQQ');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<'1w' | '1m' | '3m' | '6m' | 'ytd'>('3m');
  const [tailLength, setTailLength] = useState<number>(30);
  const [showPriceChart, setShowPriceChart] = useState<boolean>(true);
  const [priceChartType, setPriceChartType] = useState<'candlestick' | 'line'>('candlestick');

  const [report, setReport] = useState<RelativePerfReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState('');

  const [symbolBarsMap, setSymbolBarsMap] = useState<Record<string, OHLCVBar[]>>({});
  const [missingSymbols, setMissingSymbols] = useState<string[]>([]);
  const [syncingMissing, setSyncingMissing] = useState<boolean>(false);

  const fetchAnalysis = useCallback(async (symList: string[], benchSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await commands.runAnalysis<RelativePerfReport>(
        'relative-perf',
        symList,
        { benchmark: benchSymbol }
      );
      setReport(result);

      const isReal = useServiceStatusStore.getState().override === 'Real';
      const missingInFetch: string[] = [];

      // Fetch bars for all symbols in parallel to plot RRG and normalized charts
      const entries = await Promise.all(
        symList.map(async (sym) => {
          try {
            const bars = await commands.fetchMarketData(sym, '6m');
            if (bars && bars.length > 0) {
              return [sym, bars] as const;
            }
            if (isReal) {
              missingInFetch.push(sym);
              return [sym, []] as const;
            }
            return [sym, generateMockBars(sym)] as const;
          } catch {
            if (isReal) {
              missingInFetch.push(sym);
              return [sym, []] as const;
            }
            return [sym, generateMockBars(sym)] as const;
          }
        })
      );
      setSymbolBarsMap(Object.fromEntries(entries));

      const allMissing = Array.from(
        new Set([...(result.missing_symbols || []), ...missingInFetch])
      );
      setMissingSymbols(allMissing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar rendimiento relativo');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownloadMissing = async (toDownload: string[]) => {
    if (toDownload.length === 0) return;
    setSyncingMissing(true);
    try {
      await commands.resyncMarketData(toDownload, '1y');
      await fetchAnalysis(symbols, benchmark);
    } catch (e) {
      setError(`Error al descargar datos para ${toDownload.join(', ')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncingMissing(false);
    }
  };

  useEffect(() => {
    fetchAnalysis(MARKET_PRESETS.tradfi.symbols, 'SPY');
  }, [fetchAnalysis]);

  const handleSelectPreset = (presetId: PresetMode) => {
    setActivePreset(presetId);
    const p = MARKET_PRESETS[presetId];
    setBenchmark(p.benchmark);
    setSymbols(p.symbols);
    const nextSelected = p.symbols.find((s) => s !== p.benchmark) || p.symbols[0];
    setSelectedAsset(nextSelected);
    fetchAnalysis(p.symbols, p.benchmark);
  };

  const handleChangeBenchmark = (newBench: string) => {
    setBenchmark(newBench);
    let updatedSymbols = symbols;
    if (!updatedSymbols.includes(newBench)) {
      updatedSymbols = [newBench, ...updatedSymbols];
      setSymbols(updatedSymbols);
    }
    if (activePreset !== 'custom') {
      setActivePreset('custom');
    }
    fetchAnalysis(updatedSymbols, newBench);
  };

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
    setActivePreset('custom');
    fetchAnalysis(newSymbols, benchmark);
  };

  const handleRemoveSymbol = (sym: string) => {
    if (sym === benchmark) return; // Keep benchmark
    const newSymbols = symbols.filter((s) => s !== sym);
    if (newSymbols.length === 0) return;
    setSymbols(newSymbols);
    setActivePreset('custom');
    fetchAnalysis(newSymbols, benchmark);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSymbol();
    }
  };

  const data = report?.rankings ?? [];
  const currentBenchmark = report?.benchmark || benchmark;

  // Compute RRG Quadrant Data with Heading & Velocity
  const rrgPoints = useMemo<RRGDataPoint[]>(() => {
    return computeRRGData(symbolBarsMap, currentBenchmark, tailLength);
  }, [symbolBarsMap, currentBenchmark, tailLength]);

  // Lookup map for fast quadrant / heading data per symbol in table
  const rrgPointMap = useMemo(() => {
    return new Map(rrgPoints.map((pt) => [pt.symbol, pt]));
  }, [rrgPoints]);

  // Build Normalized Performance Comparison Overlays (% Change from Day 0 of selected timeframe)
  const chartOverlays = useMemo<LineOverlay[]>(() => {
    const activeSymbols = Object.keys(symbolBarsMap);
    if (!activeSymbols.length) return [];

    // Calculate cutoff date string for selected timeframe
    const now = new Date();
    const cutoffDate = new Date();
    if (chartTimeframe === '1w') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (chartTimeframe === '1m') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (chartTimeframe === '3m') {
      cutoffDate.setMonth(now.getMonth() - 3);
    } else if (chartTimeframe === '6m') {
      cutoffDate.setMonth(now.getMonth() - 6);
    } else if (chartTimeframe === 'ytd') {
      cutoffDate.setFullYear(now.getFullYear(), 0, 1);
    }
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const result: LineOverlay[] = [];

    activeSymbols.forEach((sym, idx) => {
      const allBars = symbolBarsMap[sym] || [];
      const filtered = allBars.filter((b) => b.date >= cutoffStr);
      const bars = filtered.length >= 2 ? filtered : allBars.slice(-10);
      if (!bars || bars.length < 2) return;

      const baseClose = bars[0].close;
      const normalizedData = bars.map((b) => ({
        time: b.date,
        value: Number((((b.close - baseClose) / baseClose) * 100).toFixed(2)),
      }));

      const isFocused = hoveredSymbol ? hoveredSymbol === sym : selectedAsset === sym;
      const isBench = sym === currentBenchmark;

      result.push({
        name: sym,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
        lineWidth: isFocused ? 4 : isBench ? 2.5 : 1.75,
        data: normalizedData,
      });
    });

    return result;
  }, [symbolBarsMap, chartTimeframe, hoveredSymbol, selectedAsset, currentBenchmark]);

  // Centrally computed cutoffStr for synchronizing timeframe across all 3 charts
  const cutoffStr = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    if (chartTimeframe === '1w') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (chartTimeframe === '1m') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (chartTimeframe === '3m') {
      cutoffDate.setMonth(now.getMonth() - 3);
    } else if (chartTimeframe === '6m') {
      cutoffDate.setMonth(now.getMonth() - 6);
    } else if (chartTimeframe === 'ytd') {
      cutoffDate.setFullYear(now.getFullYear(), 0, 1);
    }
    return cutoffDate.toISOString().split('T')[0];
  }, [chartTimeframe]);

  // Synchronized timeframe selector for all 3 charts
  const handleSelectTimeframe = (tf: '1w' | '1m' | '3m' | '6m' | 'ytd') => {
    setChartTimeframe(tf);
    // Synchronize RRG tail length
    if (tf === '1w') setTailLength(5);
    else if (tf === '1m') setTailLength(20);
    else if (tf === '3m') setTailLength(45);
    else if (tf === '6m') setTailLength(90);
    else if (tf === 'ytd') setTailLength(60);
  };

  // Main series data for primary baseline line
  const mainChartData = useMemo(() => {
    if (chartOverlays.length > 0 && chartOverlays[0].data.length > 0) {
      return chartOverlays[0].data as unknown as LineData<Time>[];
    }
    return [];
  }, [chartOverlays]);

  const selectedAssetBars = symbolBarsMap[selectedAsset] || [];

  // Candlestick / Line data for traditional price series chart synchronized with timeframe
  const selectedCandleData = useMemo(() => {
    const allBars = symbolBarsMap[selectedAsset] || [];
    const filtered = allBars.filter((b) => b.date >= cutoffStr);
    const bars = filtered.length >= 2 ? filtered : allBars.slice(-10);

    if (priceChartType === 'candlestick') {
      return bars.map((b) => ({
        time: b.date as unknown as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })) as unknown as CandlestickData<Time>[];
    } else {
      return bars.map((b) => ({
        time: b.date as unknown as Time,
        value: b.close,
      })) as unknown as LineData<Time>[];
    }
  }, [symbolBarsMap, selectedAsset, cutoffStr, priceChartType]);

  return (
    <div style={styles.container}>
      {/* Module Title Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Alpha Rotation & RS Radar 📡</h2>
          <p style={styles.subtitle}>
            Matriz de Cuadrantes RRG (Relative Rotation Graph), Rumbo Angular y Comparativa Multimoneda
          </p>
        </div>
        <div style={styles.benchHeaderBadge}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Benchmark Activo:</span>
          <span style={styles.benchHeaderPill}>{currentBenchmark}</span>
        </div>
      </div>

      {/* Preset Selector Pill Tabs */}
      <div className="cyber-card" style={styles.presetsCard}>
        <div style={styles.presetsHeader}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Universos & Benchmarks Predefinidos:
          </span>
        </div>
        <div style={styles.presetsRow}>
          {(Object.keys(MARKET_PRESETS) as PresetMode[]).map((mode) => {
            const p = MARKET_PRESETS[mode];
            const isSelected = activePreset === mode;
            return (
              <button
                key={mode}
                onClick={() => handleSelectPreset(mode)}
                style={{
                  ...styles.presetBtn,
                  backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', opacity: isSelected ? 0.9 : 0.6 }}>{p.badge}</div>
                </div>
              </button>
            );
          })}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {MARKET_PRESETS[activePreset].description}
        </p>
      </div>

      {/* Symbol Selection Bar */}
      <div style={styles.symbolBar}>
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Agregar activo al radar (ej. NVDA, AAPL, SOL, ETH, GLD)..."
            style={styles.input}
            aria-label="Agregar activo al radar"
          />
          <button onClick={handleAddSymbol} style={styles.addBtn}>
            + Agregar Activo
          </button>
        </div>
        <div style={styles.symbolTags}>
          {symbols.map((sym) => {
            const isBench = sym === currentBenchmark;
            return (
              <span
                key={sym}
                style={{
                  ...styles.symbolTag,
                  borderColor: isBench ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: isBench ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                }}
              >
                {isBench ? `⭐ ${sym} (Bench)` : sym}
                {!isBench && (
                  <button
                    onClick={() => handleRemoveSymbol(sym)}
                    style={styles.removeBtn}
                    title={`Eliminar ${sym}`}
                    aria-label={`Eliminar ${sym}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Missing Real Data Banner (Modo Real Integrity Guard) */}
      {missingSymbols.length > 0 && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--signal-warning)' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>
              <strong>Faltan datos históricos reales para:</strong> {missingSymbols.join(', ')}.
              Se excluyeron del cálculo para garantizar que no existan cruces con datos sintéticos.
            </span>
          </div>
          <button
            onClick={() => handleDownloadMissing(missingSymbols)}
            disabled={syncingMissing}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: syncingMissing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {syncingMissing ? '⏳ Descargando...' : '📥 Descargar datos reales ahora'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Calculando matriz RRG y curvas de fuerza relativa contra {currentBenchmark}...</span>
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
          <button onClick={() => fetchAnalysis(symbols, currentBenchmark)} style={styles.retryBtn}>
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
              label={`Score RS Máximo (vs ${currentBenchmark})`}
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

          {/* GLOBAL TIMEFRAME SYNCHRONIZATION BAR (Synchronizes all 3 charts) */}
          <div className="cyber-card" style={styles.syncBarCard}>
            <div style={styles.syncBarLeft}>
              <span style={{ fontSize: '1.25rem' }}>⏱️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Temporalidad Sincronizada (3 Gráficos Simultáneos)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Ajusta en paralelo: 1) Matriz RRG ({tailLength}d cola), 2) Serie Tradicional + Oscilador ({selectedAsset}), y 3) Curvas de Retorno Normalizado (%)
                </div>
              </div>
            </div>
            <div style={styles.syncBarButtons}>
              {(['1w', '1m', '3m', '6m', 'ytd'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleSelectTimeframe(tf)}
                  style={{
                    ...styles.syncTfBtn,
                    backgroundColor: chartTimeframe === tf ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: chartTimeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                    borderColor: chartTimeframe === tf ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 1. RELATIVE ROTATION GRAPH (RRG) QUADRANT CHART */}
          <RRGQuadrantChart
            points={rrgPoints}
            benchmarkSymbol={currentBenchmark}
            availableBenchmarks={symbols}
            onChangeBenchmark={handleChangeBenchmark}
            tailLength={tailLength}
            onChangeTailLength={setTailLength}
            selectedSymbol={selectedAsset}
            onSelectSymbol={(sym) => setSelectedAsset(sym)}
            hoveredSymbol={hoveredSymbol}
            onHoverSymbol={setHoveredSymbol}
          />

          {/* 2. TRADITIONAL PRICE SERIES & ELLIOTT OSCILLATOR */}
          <div className="cyber-card" style={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={styles.sectionTitle}>Serie de Precios Tradicional & Oscilador de Elliott 🌊</h3>
                  <span style={styles.benchHeaderPill}>{selectedAsset}</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Velas/precios alineados verticalmente con el Oscilador de Elliott (35, 5) en temporalidad sincronizada ({chartTimeframe.toUpperCase()}).
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowPriceChart((s) => !s)}
                  style={{
                    ...styles.controlBtn,
                    backgroundColor: showPriceChart ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                    color: showPriceChart ? 'var(--accent)' : 'var(--text-secondary)',
                    borderColor: showPriceChart ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {showPriceChart ? '📊 Ocultar Serie de Precios' : '📊 Abrir Serie Tradicional'}
                </button>

                {showPriceChart && (
                  <div style={styles.typeToggleGroup}>
                    <button
                      onClick={() => setPriceChartType('candlestick')}
                      style={{
                        ...styles.typeToggleBtn,
                        backgroundColor: priceChartType === 'candlestick' ? 'var(--accent)' : 'transparent',
                        color: priceChartType === 'candlestick' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      🕯️ Velas
                    </button>
                    <button
                      onClick={() => setPriceChartType('line')}
                      style={{
                        ...styles.typeToggleBtn,
                        backgroundColor: priceChartType === 'line' ? 'var(--accent)' : 'transparent',
                        color: priceChartType === 'line' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      📈 Línea
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Asset Selector Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Activo Seleccionado:</span>
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

            {/* Traditional Price Chart (Candlestick / Line) */}
            {showPriceChart && selectedCandleData.length > 0 && (
              <div style={{ marginBottom: 14, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <FinancialChart
                  type={priceChartType}
                  data={selectedCandleData}
                  height={280}
                  allowWheelZoom={false}
                />
              </div>
            )}

            {/* Elliott Oscillator aligned below */}
            <ElliottOscillatorChart
              bars={selectedAssetBars}
              symbol={selectedAsset}
              cutoffDate={cutoffStr}
              height={170}
            />
          </div>

          {/* 3. NORMALIZED PERFORMANCE COMPARISON CHART */}
          {chartOverlays.length > 0 && (
            <div className="cyber-card" style={styles.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={styles.sectionTitle}>Curvas de Rendimiento Normalizado (%) 📈</h3>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {hoveredSymbol ? `Resaltando: ${hoveredSymbol}` : `Seleccionado: ${selectedAsset}`}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Retorno porcentual acumulado (base 0% al inicio de la ventana {chartTimeframe.toUpperCase()}). Escala fijada sin captura de scroll.
                  </p>
                </div>

                {/* Timeframe Selector Buttons */}
                <div style={styles.timeframeSelector}>
                  {(['1w', '1m', '3m', '6m', 'ytd'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleSelectTimeframe(tf)}
                      style={{
                        ...styles.timeframeBtn,
                        backgroundColor: chartTimeframe === tf ? 'var(--accent)' : 'transparent',
                        color: chartTimeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <FinancialChart
                type="line"
                data={mainChartData}
                overlays={chartOverlays}
                height={340}
                allowWheelZoom={false}
              />
            </div>
          )}

          {/* 4. ENRICHED RS HEATMAP MATRIX & TILES */}
          <RSHeatmapMatrix
            rankings={data}
            rrgPointMap={rrgPointMap}
            currentBenchmark={currentBenchmark}
            selectedAsset={selectedAsset}
            onSelectAsset={(sym) => setSelectedAsset(sym)}
            hoveredSymbol={hoveredSymbol}
            onHoverSymbol={setHoveredSymbol}
          />

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnalysis(symbols, currentBenchmark)}
            style={styles.refreshBtn}
            disabled={loading}
          >
            🔄 Actualizar Datos & Recalcular Rotación
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
  let basePrice = sym === 'BTC' ? 66000 : sym === 'ETH' ? 3500 : sym === 'SOL' ? 150 : sym === 'BNB' ? 580 : sym === 'NVDA' ? 128 : sym === 'AAPL' ? 224 : sym === 'GLD' ? 230 : sym === 'TLT' ? 95 : 545;
  const symHash = sym.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const startDate = new Date('2025-08-01');

  for (let i = 0; i <= 365; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    const rnd = seededRandom(symHash * 1000 + i);
    const change = (rnd - 0.485) * (basePrice * 0.015);
    const open = basePrice;
    const close = Math.max(0.01, open + change);
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

// RRG Mathematical Computation Function with Heading Angle & Velocity
function computeRRGData(
  symbolBarsMap: Record<string, OHLCVBar[]>,
  benchmarkSymbol: string = 'SPY',
  tailLength: number = 30
): RRGDataPoint[] {
  const benchBars = symbolBarsMap[benchmarkSymbol];
  if (!benchBars || benchBars.length < 20) return [];

  const points: RRGDataPoint[] = [];

  Object.keys(symbolBarsMap).forEach((sym) => {
    if (sym === benchmarkSymbol) return;

    const assetBars = symbolBarsMap[sym];
    if (!assetBars || assetBars.length < 20) return;

    const benchDateMap = new Map(benchBars.map((b) => [b.date, b.close]));

    const prSeries: { date: string; pr: number }[] = [];
    assetBars.forEach((b) => {
      const benchClose = benchDateMap.get(b.date);
      if (benchClose) {
        prSeries.push({ date: b.date, pr: b.close / benchClose });
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

    const tailHistory = xyHistory.length > tailLength + 1
      ? xyHistory.slice(-(tailLength + 1), -1)
      : xyHistory.slice(0, -1);
    const lastPoint = xyHistory[xyHistory.length - 1];
    const prevPoint = xyHistory.length > 1 ? xyHistory[xyHistory.length - 2] : lastPoint;

    // Direction vector & Heading angle (0° to 360°)
    const dx = lastPoint.x - prevPoint.x;
    const dy = lastPoint.y - prevPoint.y;
    const velocity = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    const heading = Math.round(deg);

    let headingArrow = '→';
    if (heading >= 22.5 && heading < 67.5) headingArrow = '↗';
    else if (heading >= 67.5 && heading < 112.5) headingArrow = '↑';
    else if (heading >= 112.5 && heading < 157.5) headingArrow = '↖';
    else if (heading >= 157.5 && heading < 202.5) headingArrow = '←';
    else if (heading >= 202.5 && heading < 247.5) headingArrow = '↙';
    else if (heading >= 247.5 && heading < 292.5) headingArrow = '↓';
    else if (heading >= 292.5 && heading < 337.5) headingArrow = '↘';

    let quadrant: RRGQuadrant = 'Leading';
    if (lastPoint.x >= 0 && lastPoint.y >= 0) quadrant = 'Leading';
    else if (lastPoint.x >= 0 && lastPoint.y < 0) quadrant = 'Weakening';
    else if (lastPoint.x < 0 && lastPoint.y < 0) quadrant = 'Lagging';
    else quadrant = 'Improving';

    points.push({
      symbol: sym,
      x: lastPoint.x,
      y: lastPoint.y,
      history: tailHistory,
      heading,
      headingArrow,
      velocity,
      quadrant,
    });
  });

  return points;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1280, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0' },
  benchHeaderBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--bg-secondary)',
    padding: '6px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  benchHeaderPill: {
    padding: '2px 8px',
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    borderRadius: 4,
    fontSize: '0.8125rem',
    fontWeight: 700,
  },
  presetsCard: {
    backgroundColor: 'var(--bg-surface-elevated, var(--bg-secondary))',
    borderRadius: 'var(--radius)',
    padding: '16px 20px',
    border: '1px solid var(--border)',
    marginBottom: 16,
  },
  presetsHeader: {
    marginBottom: 10,
  },
  presetsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  symbolBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  inputGroup: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  addBtn: {
    padding: '10px 18px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  symbolTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  symbolTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
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
    backgroundColor: 'var(--bg-surface-elevated, var(--bg-secondary))',
    borderRadius: 'var(--radius)',
    padding: 20,
    border: '1px solid var(--border)',
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' },
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
  td: { padding: '9px 8px', whiteSpace: 'nowrap', color: 'var(--text-primary)' },
  quadrantBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'inline-block',
  },
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
  timeframeSelector: {
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    padding: 3,
    borderRadius: 6,
    border: '1px solid var(--border)',
    gap: 2,
  },
  timeframeBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  syncBarCard: {
    backgroundColor: 'var(--bg-surface-elevated, var(--bg-secondary))',
    borderRadius: 'var(--radius)',
    padding: '12px 18px',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  syncBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  syncBarButtons: {
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    padding: 3,
    borderRadius: 6,
    border: '1px solid var(--border)',
    gap: 3,
  },
  syncTfBtn: {
    padding: '5px 12px',
    borderRadius: 4,
    border: '1px solid transparent',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  controlBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  typeToggleGroup: {
    display: 'inline-flex',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeToggleBtn: {
    padding: '3px 8px',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
