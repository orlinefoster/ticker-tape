import { useState, useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type AreaData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { Card, Button, Badge } from '@/components/ui';
import {
  buildEquityCurvePoints,
} from '../services/equityEngine';
import { SYNTHETIC_SYMBOLS, getSyntheticBars } from '../services/syntheticCatalog';

interface EquityCurveChartProps {
  totalEquity?: number;
  initialSymbol?: string;
  onOpenInChartModule?: (symbol: string) => void;
}

export function EquityCurveChart({
  totalEquity = 57263.5,
  initialSymbol = 'PORTFOLIO:TOTAL',
  onOpenInChartModule,
}: EquityCurveChartProps) {
  const [activeSymbol, setActiveSymbol] = useState(initialSymbol);
  const [chartType, setChartType] = useState<'area' | 'candlestick' | 'line'>('area');
  const [showReversionLine, setShowReversionLine] = useState(true);
  const [showSMAs, setShowSMAs] = useState(true);
  const [showDrawdownPanel, setShowDrawdownPanel] = useState(true);

  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const ddChartContainerRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const ddChartRef = useRef<IChartApi | null>(null);

  const mainSeriesRef = useRef<ISeriesApi<'Area' | 'Candlestick' | 'Line'> | null>(null);
  const reversionSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ddSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  // Generate bars and regression
  const bars = useMemo(() => getSyntheticBars(activeSymbol, totalEquity), [activeSymbol, totalEquity]);

  const rawEquityPoints = useMemo(() => {
    return bars.map((b) => ({
      date: b.date,
      equity: b.close,
      cash: 4850,
      invested: b.close - 4850,
      unrealizedPnL: b.close - totalEquity * 0.85,
      realizedPnLCumulative: 1450,
    }));
  }, [bars, totalEquity]);

  const curveData = useMemo(() => buildEquityCurvePoints(rawEquityPoints), [rawEquityPoints]);

  const { reversionAnalysis, drawdownAnalysis, streakAnalysis } = curveData;

  // Initialize and update main chart
  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    if (mainChartRef.current) {
      mainChartRef.current.remove();
      mainChartRef.current = null;
    }

    const chart = createChart(mainChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0e111a' },
        textColor: '#8e98b0',
        fontSize: 11,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 107, 157, 0.05)' },
        horzLines: { color: 'rgba(255, 107, 157, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0, 229, 255, 0.5)', width: 1, style: 3 },
        horzLine: { color: 'rgba(0, 229, 255, 0.5)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    mainChartRef.current = chart;

    // Add main series
    if (chartType === 'area') {
      const series = chart.addAreaSeries({
        lineColor: '#FF6B9D',
        topColor: 'rgba(255, 107, 157, 0.38)',
        bottomColor: 'rgba(179, 136, 255, 0.02)',
        lineWidth: 2,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      const areaData: AreaData[] = bars.map((b) => ({ time: b.date as Time, value: b.close }));
      series.setData(areaData);
      mainSeriesRef.current = series;
    } else if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#00F5D4',
        downColor: '#FF3366',
        borderUpColor: '#00F5D4',
        borderDownColor: '#FF3366',
        wickUpColor: '#00F5D4',
        wickDownColor: '#FF3366',
      });
      const candleData: CandlestickData[] = bars.map((b) => ({
        time: b.date as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
      series.setData(candleData);
      mainSeriesRef.current = series;
    } else {
      const series = chart.addLineSeries({
        color: '#00E5FF',
        lineWidth: 2,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      const lineData: LineData[] = bars.map((b) => ({ time: b.date as Time, value: b.close }));
      series.setData(lineData);
      mainSeriesRef.current = series;
    }

    // Reversion Line (Linear Regression)
    if (showReversionLine && curveData.points.length > 0) {
      const revSeries = chart.addLineSeries({
        color: '#FFE082',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        title: 'Línea de Reversión (Regresión)',
      });
      const revData: LineData[] = curveData.points.map((p) => ({
        time: p.date as Time,
        value: p.reversionLine ?? p.equity,
      }));
      revSeries.setData(revData);
      reversionSeriesRef.current = revSeries;
    }

    // SMA 20 Overlay
    if (showSMAs && bars.length >= 20) {
      const smaSeries = chart.addLineSeries({
        color: '#B388FF',
        lineWidth: 1,
        title: 'SMA 20',
      });
      const smaData: LineData[] = [];
      for (let i = 19; i < bars.length; i++) {
        const slice = bars.slice(i - 19, i + 1);
        const avg = slice.reduce((sum, b) => sum + b.close, 0) / 20;
        smaData.push({ time: bars[i].date as Time, value: Math.round(avg * 100) / 100 });
      }
      smaSeries.setData(smaData);
      sma20SeriesRef.current = smaSeries;
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (mainChartContainerRef.current && mainChartRef.current) {
        mainChartRef.current.applyOptions({
          width: mainChartContainerRef.current.clientWidth,
          height: mainChartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
    };
  }, [bars, chartType, showReversionLine, showSMAs, curveData]);

  // Underwater Drawdown Sub-panel Chart
  useEffect(() => {
    if (!showDrawdownPanel || !ddChartContainerRef.current) return;

    if (ddChartRef.current) {
      ddChartRef.current.remove();
      ddChartRef.current = null;
    }

    const ddChart = createChart(ddChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090b12' },
        textColor: '#6f7895',
        fontSize: 10,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 51, 102, 0.05)' },
        horzLines: { color: 'rgba(255, 51, 102, 0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    ddChartRef.current = ddChart;

    const ddSeries = ddChart.addAreaSeries({
      lineColor: '#FF3366',
      topColor: 'rgba(255, 51, 102, 0.02)',
      bottomColor: 'rgba(255, 51, 102, 0.35)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `${price.toFixed(1)}%`,
      },
    });

    const ddData: AreaData[] = curveData.points.map((p) => ({
      time: p.date as Time,
      value: p.drawdownPct,
    }));
    ddSeries.setData(ddData);
    ddSeriesRef.current = ddSeries;

    ddChart.timeScale().fitContent();

    const handleResize = () => {
      if (ddChartContainerRef.current && ddChartRef.current) {
        ddChartRef.current.applyOptions({
          width: ddChartContainerRef.current.clientWidth,
          height: ddChartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ddChartRef.current) {
        ddChartRef.current.remove();
        ddChartRef.current = null;
      }
    };
  }, [showDrawdownPanel, curveData]);

  const activeSymbolObj = SYNTHETIC_SYMBOLS.find((s) => s.symbol === activeSymbol);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Toolbar & Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 14px',
          background: 'rgba(15, 18, 28, 0.75)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Símbolo Sintético:
          </span>
          <select
            value={activeSymbol}
            onChange={(e) => setActiveSymbol(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              background: '#151926',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: 'var(--text-bright)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SYNTHETIC_SYMBOLS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.icon} {s.symbol} — {s.name}
              </option>
            ))}
          </select>

          {activeSymbolObj && (
            <Badge variant="lavender">{activeSymbolObj.category}</Badge>
          )}

          {reversionAnalysis.regime === 'HIGH_PERFORMANCE' && (
            <Badge variant="mint">🚀 HIGH PERFORMANCE (&gt; REVERSIÓN)</Badge>
          )}
          {reversionAnalysis.regime === 'UNDER_PERFORMANCE' && (
            <Badge variant="bearish">⚠️ UNDER PERFORMANCE (&lt; REVERSIÓN)</Badge>
          )}
          {reversionAnalysis.regime === 'NEUTRAL' && (
            <Badge variant="neutral">⚖️ RÉGIMEN NEUTRAL</Badge>
          )}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => setChartType('area')}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                border: 'none',
                background: chartType === 'area' ? 'rgba(255, 107, 157, 0.25)' : 'transparent',
                color: chartType === 'area' ? 'var(--text-bright)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Área
            </button>
            <button
              onClick={() => setChartType('candlestick')}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                border: 'none',
                background: chartType === 'candlestick' ? 'rgba(0, 245, 212, 0.25)' : 'transparent',
                color: chartType === 'candlestick' ? 'var(--text-bright)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Velas
            </button>
            <button
              onClick={() => setChartType('line')}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                border: 'none',
                background: chartType === 'line' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
                color: chartType === 'line' ? 'var(--text-bright)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Línea
            </button>
          </div>

          <Button
            size="sm"
            variant={showReversionLine ? 'holo' : 'ghost'}
            onClick={() => setShowReversionLine(!showReversionLine)}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            📉 Reversión
          </Button>

          <Button
            size="sm"
            variant={showSMAs ? 'sakura' : 'ghost'}
            onClick={() => setShowSMAs(!showSMAs)}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            SMA 20
          </Button>

          <Button
            size="sm"
            variant={showDrawdownPanel ? 'holo' : 'ghost'}
            onClick={() => setShowDrawdownPanel(!showDrawdownPanel)}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            🌊 Drawdown
          </Button>

          {onOpenInChartModule && (
            <Button
              size="sm"
              variant="holo"
              onClick={() => onOpenInChartModule(activeSymbol)}
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              ↗️ Abrir en #Gráficos
            </Button>
          )}
        </div>
      </div>

      {/* Main Canvas Chart */}
      <Card variant="glass" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              {activeSymbolObj ? `${activeSymbolObj.icon} ${activeSymbolObj.name}` : activeSymbol}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              TradingView Lightweight Charts • Motor de Equity &amp; Análisis Chartista
            </div>
          </div>

          {/* Real-time slope & streak info */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '0.75rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Pendiente: </span>
              <strong className="font-mono" style={{ color: reversionAnalysis.slope >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                {reversionAnalysis.slope >= 0 ? '+' : ''}{reversionAnalysis.slope.toFixed(1)} USDT/día (R²: {reversionAnalysis.rSquared})
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Racha actual: </span>
              <strong className="font-mono" style={{ color: streakAnalysis.currentStreakType === 'WIN' ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                {streakAnalysis.currentStreakCount} {streakAnalysis.currentStreakType}
              </strong>
            </div>
          </div>
        </div>

        <div
          ref={mainChartContainerRef}
          style={{
            width: '100%',
            height: showDrawdownPanel ? '320px' : '440px',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        />
      </Card>

      {/* Sub-panel: Underwater Drawdown (% from Peak) */}
      {showDrawdownPanel && (
        <Card style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--signal-bearish)' }}>
                🌊 Curva de Drawdown Submarino (% Underwater)
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Profundidad desde el último máximo histórico (High-Water Mark).
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem' }}>
              <span>
                Max Drawdown: <strong style={{ color: 'var(--signal-bearish)' }}>{drawdownAnalysis.maxDrawdownPct}%</strong>
              </span>
              <span>
                DD Actual: <strong style={{ color: drawdownAnalysis.currentDrawdownPct < 0 ? 'var(--signal-bearish)' : 'var(--signal-bullish)' }}>{drawdownAnalysis.currentDrawdownPct}%</strong>
              </span>
              <span>
                Mayor período bajo agua: <strong>{drawdownAnalysis.longestDrawdownDays} días</strong>
              </span>
              <span>
                Recupero medio: <strong>{drawdownAnalysis.avgRecoveryDays} días</strong>
              </span>
            </div>
          </div>

          <div
            ref={ddChartContainerRef}
            style={{
              width: '100%',
              height: '130px',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          />
        </Card>
      )}
    </div>
  );
}
