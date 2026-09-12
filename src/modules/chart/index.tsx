import { useState, useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { useUIStore } from '@/store/uiStore';

export interface AssetReference {
  symbol: string;
  name: string;
  category: 'ETF' | 'Stock' | 'Crypto' | 'Commodity' | 'Bond' | 'Sector';
  exchange: string;
  icon: string;
}

export const ASSET_CATALOG: AssetReference[] = [
  // ETFs & Indices
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'ETF', exchange: 'NYSE Arca', icon: '📊' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', category: 'ETF', exchange: 'NASDAQ', icon: '💻' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', category: 'ETF', exchange: 'NYSE Arca', icon: '📈' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average', category: 'ETF', exchange: 'NYSE Arca', icon: '🏛️' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', category: 'ETF', exchange: 'NYSE Arca', icon: '🌐' },

  // Megacap Tech Stocks
  { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'Stock', exchange: 'NASDAQ', icon: '🟢' },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '🍎' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'Stock', exchange: 'NASDAQ', icon: '🪟' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '📦' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', category: 'Stock', exchange: 'NASDAQ', icon: '🔍' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '⚡' },
  { symbol: 'META', name: 'Meta Platforms Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '♾️' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '🔴' },

  // Crypto & Crypto Proxies
  { symbol: 'BTC', name: 'Bitcoin Spot Proxy', category: 'Crypto', exchange: 'Crypto', icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum Spot Proxy', category: 'Crypto', exchange: 'Crypto', icon: 'Ξ' },
  { symbol: 'SOL', name: 'Solana Spot Proxy', category: 'Crypto', exchange: 'Crypto', icon: '◎' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', category: 'Stock', exchange: 'NASDAQ', icon: '🪙' },
  { symbol: 'MSTR', name: 'MicroStrategy Incorporated', category: 'Stock', exchange: 'NASDAQ', icon: '🟧' },

  // Commodities
  { symbol: 'GLD', name: 'SPDR Gold Shares', category: 'Commodity', exchange: 'NYSE Arca', icon: '🥇' },
  { symbol: 'SLV', name: 'iShares Silver Trust', category: 'Commodity', exchange: 'NYSE Arca', icon: '🥈' },
  { symbol: 'USO', name: 'United States Oil Fund (Crude Oil)', category: 'Commodity', exchange: 'NYSE Arca', icon: '🛢️' },
  { symbol: 'DBC', name: 'Invesco DB Commodity Index', category: 'Commodity', exchange: 'NYSE Arca', icon: '🌾' },

  // Bonds & Treasury
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond', category: 'Bond', exchange: 'NASDAQ', icon: '🏦' },
  { symbol: 'IEF', name: 'iShares 7-10 Year Treasury Bond', category: 'Bond', exchange: 'NASDAQ', icon: '📜' },
  { symbol: 'HYG', name: 'iShares High Yield Corporate Bond', category: 'Bond', exchange: 'NYSE Arca', icon: '💳' },

  // Sectors
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', category: 'Sector', exchange: 'NYSE Arca', icon: '⚙️' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', category: 'Sector', exchange: 'NYSE Arca', icon: '🏦' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', category: 'Sector', exchange: 'NYSE Arca', icon: '⚡' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR', category: 'Sector', exchange: 'NYSE Arca', icon: '🏥' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select SPDR', category: 'Sector', exchange: 'NYSE Arca', icon: '🛒' },
];

const TIMEFRAMES = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '1y', label: '1Y' },
  { id: '2y', label: '2Y' },
  { id: '5y', label: '5Y' },
];

interface WaveLabel {
  symbol: string;
  wave_degree: string;
  wave_label: string;
  start_date: string;
  confidence: number;
  price_start?: number;
}

export default function MarketChartModule() {
  const [symbol, setSymbol] = useState('SPY');
  const [inputSymbol, setInputSymbol] = useState('SPY');
  const [timeframe, setTimeframe] = useState('1y');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');

  // Autocomplete state
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Technical Indicators
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(false);

  // ELLIOTT WAVE INTEGRATION
  const [showElliottWaves, setShowElliottWaves] = useState(false);
  const [waveLabels, setWaveLabels] = useState<WaveLabel[]>([]);
  const [recountingWaves, setRecountingWaves] = useState(false);

  // Active Tool on Left Toolbar
  const [activeTool, setActiveTool] = useState<'crosshair' | 'trendline' | 'fibo' | 'elliott' | 'measure'>('crosshair');
  const [showWatchlist, setShowWatchlist] = useState(true);

  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [providerUsed, setProviderUsed] = useState<string>('');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const theme = useUIStore((state) => state.theme);

  // Outside click listener for autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Asset Catalog dynamically
  const filteredAssets = ASSET_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const query = inputSymbol.trim().toLowerCase();
    const matchesQuery =
      !query ||
      item.symbol.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);

    return matchesCategory && matchesQuery;
  });

  // Load Market Data & Waves
  const loadMarketData = async (sym: string, tf: string) => {
    setLoading(true);
    try {
      const diag = await commands.testProviderFetch(sym, tf, false, 'auto');
      const fetched = await commands.fetchMarketData(sym, tf);
      if (fetched && fetched.length > 0) {
        setBars(fetched);
        setProviderUsed(diag.provider_used || 'unknown');
        const isMock =
          (diag.provider_used || '').toLowerCase().includes('mock') ||
          (diag.provider_used || '').toLowerCase().includes('synthetic');
        setIsMockData(isMock);
      } else {
        setBars(generateMockBars(sym, tf));
        setProviderUsed('browser-mock-generator');
        setIsMockData(true);
      }
    } catch {
      setBars(generateMockBars(sym, tf));
      setProviderUsed('browser-mock-generator');
      setIsMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const loadElliottData = async (sym: string) => {
    try {
      const labels = (await commands.loadWaveLabels(sym)) as WaveLabel[];
      if (labels && labels.length > 0) {
        setWaveLabels(labels);
      } else {
        const fresh = (await commands.recountWaves(sym)) as WaveLabel[];
        setWaveLabels(fresh || generateMockWaves(sym));
      }
    } catch {
      setWaveLabels(generateMockWaves(sym));
    }
  };

  const handleRecountWaves = async () => {
    setRecountingWaves(true);
    try {
      const fresh = (await commands.recountWaves(symbol)) as WaveLabel[];
      setWaveLabels(fresh || generateMockWaves(symbol));
    } catch {
      setWaveLabels(generateMockWaves(symbol));
    } finally {
      setRecountingWaves(false);
    }
  };

  useEffect(() => {
    loadMarketData(symbol, timeframe);
    if (showElliottWaves) {
      loadElliottData(symbol);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (showElliottWaves) {
      loadElliottData(symbol);
    }
  }, [showElliottWaves]);

  // Initialize & Render TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';
    const bg = isDark ? '#131722' : '#ffffff';
    const textColor = isDark ? '#d1d4dc' : '#131722';
    const gridColor = isDark ? '#1e222d' : '#f0f3fa';
    const borderColor = isDark ? '#2a2e39' : '#e0e3eb';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: textColor,
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const upColor = '#089981';
    const downColor = '#f23645';

    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>;

    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else if (chartType === 'area') {
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(41, 98, 255, 0.35)',
        bottomColor: 'rgba(41, 98, 255, 0.0)',
        lineColor: '#2962ff',
        lineWidth: 2,
      });
    } else {
      mainSeries = chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 2,
      });
    }
    mainSeriesRef.current = mainSeries;

    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        priceScaleId: 'volume',
        priceFormat: { type: 'volume' },
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.75,
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;
    }

    if (showSMA20) {
      sma20Ref.current = chart.addLineSeries({
        color: '#ff9800',
        lineWidth: 2,
        title: 'SMA 20',
      });
    }
    if (showSMA50) {
      sma50Ref.current = chart.addLineSeries({
        color: '#2196f3',
        lineWidth: 2,
        title: 'SMA 50',
      });
    }
    if (showSMA200) {
      sma200Ref.current = chart.addLineSeries({
        color: '#9c27b0',
        lineWidth: 2,
        title: 'SMA 200',
      });
    }

    chart.subscribeCrosshairMove((param) => {
      if (param.time && bars.length) {
        const found = bars.find((b) => b.date === param.time);
        if (found) setHoveredBar(found);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma20Ref.current = null;
      sma50Ref.current = null;
      sma200Ref.current = null;
    };
  }, [theme, chartType, showVolume, showSMA20, showSMA50, showSMA200]);

  // Feed bars data and Elliott Wave markers into chart series
  useEffect(() => {
    if (!bars.length || !mainSeriesRef.current) return;

    if (chartType === 'candlestick') {
      const cData: CandlestickData<Time>[] = bars.map((b) => ({
        time: b.date as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
      mainSeriesRef.current.setData(cData as any);
    } else {
      const lData: LineData<Time>[] = bars.map((b) => ({
        time: b.date as Time,
        value: b.close,
      }));
      mainSeriesRef.current.setData(lData as any);
    }

    if (volumeSeriesRef.current) {
      const vData: HistogramData<Time>[] = bars.map((b) => ({
        time: b.date as Time,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
      }));
      volumeSeriesRef.current.setData(vData as any);
    }

    const calcSMA = (period: number) => {
      const res: { time: Time; value: number }[] = [];
      for (let i = 0; i < bars.length; i++) {
        if (i < period - 1) continue;
        const slice = bars.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b.close, 0);
        res.push({ time: bars[i].date as Time, value: sum / period });
      }
      return res;
    };

    if (sma20Ref.current && bars.length >= 20) sma20Ref.current.setData(calcSMA(20) as any);
    if (sma50Ref.current && bars.length >= 50) sma50Ref.current.setData(calcSMA(50) as any);
    if (sma200Ref.current && bars.length >= 200) sma200Ref.current.setData(calcSMA(200) as any);

    if (showElliottWaves && waveLabels.length > 0 && mainSeriesRef.current.setMarkers) {
      const markers: SeriesMarker<Time>[] = waveLabels
        .filter((w) => w.start_date)
        .map((w) => {
          const isImpulse = ['1', '3', '5'].includes(w.wave_label);
          const isDip = ['2', '4', 'A', 'C'].includes(w.wave_label);
          return {
            time: w.start_date as Time,
            position: isImpulse ? 'aboveBar' : isDip ? 'belowBar' : 'aboveBar',
            color: isImpulse ? '#00e676' : '#ff9100',
            shape: isImpulse ? 'arrowDown' : 'arrowUp',
            text: `(W${w.wave_label})`,
          };
        });

      mainSeriesRef.current.setMarkers(markers);
    } else if (mainSeriesRef.current.setMarkers) {
      mainSeriesRef.current.setMarkers([]);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [bars, chartType, showElliottWaves, waveLabels]);

  const lastBar = bars[bars.length - 1];
  const activeBar = hoveredBar || lastBar;
  const prevBar = bars.length > 1 ? bars[bars.length - 2] : null;
  const changeVal = lastBar && prevBar ? lastBar.close - prevBar.close : 0;
  const changePct = prevBar ? (changeVal / prevBar.close) * 100 : 0;

  const handleSelectAsset = (sym: string) => {
    setSymbol(sym);
    setInputSymbol(sym);
    setShowSearchDropdown(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputSymbol.trim().toUpperCase();
    if (clean) {
      setSymbol(clean);
      setShowSearchDropdown(false);
    }
  };

  const activeAssetRef = ASSET_CATALOG.find((a) => a.symbol === symbol);

  return (
    <div style={styles.tvWorkspace}>
      {/* 1. TradingView Top Toolbar */}
      <header style={styles.tvTopBar}>
        {/* Symbol Search & Rich Autocomplete Reference Catalog */}
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={styles.symbolBadge}>
              <span>{activeAssetRef ? activeAssetRef.icon : '📈'}</span>
              <span style={{ fontWeight: 800, color: '#2962ff' }}>{symbol}</span>
            </div>
            <input
              type="text"
              value={inputSymbol}
              onChange={(e) => {
                setInputSymbol(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder="Buscar activo (ej: SPY, NVDA, BTC)..."
              style={styles.tvSearchInput}
            />
          </form>

          {/* Autocomplete Dropdown Catalog */}
          {showSearchDropdown && (
            <div style={styles.autocompleteDropdown}>
              {/* Category Filter Tabs */}
              <div style={styles.categoryTabs}>
                {['ALL', 'ETF', 'Stock', 'Crypto', 'Commodity', 'Bond', 'Sector'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      ...styles.categoryTabBtn,
                      backgroundColor: selectedCategory === cat ? 'var(--accent)' : 'transparent',
                      color: selectedCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {cat === 'ALL' ? 'Todos' : cat}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div style={styles.catalogItemsList}>
                {filteredAssets.length > 0 ? (
                  filteredAssets.map((asset) => (
                    <div
                      key={asset.symbol}
                      onClick={() => handleSelectAsset(asset.symbol)}
                      style={{
                        ...styles.catalogItem,
                        backgroundColor: symbol === asset.symbol ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{asset.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {asset.symbol}
                          </strong>
                          <span style={styles.tagExchange}>{asset.exchange}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {asset.name}
                        </span>
                      </div>
                      <span style={styles.tagCategory}>{asset.category}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Presiona Enter para buscar "{inputSymbol}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={styles.tvDivider} />

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              style={{
                ...styles.tvToolBtn,
                backgroundColor: timeframe === tf.id ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
                color: timeframe === tf.id ? '#2962ff' : 'var(--text-primary)',
                fontWeight: timeframe === tf.id ? 700 : 400,
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div style={styles.tvDivider} />

        {/* Chart Type Toggle */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setChartType('candlestick')}
            style={{
              ...styles.tvToolBtn,
              backgroundColor: chartType === 'candlestick' ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
              color: chartType === 'candlestick' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Velas Japonesas"
          >
            🕯️ Velas
          </button>
          <button
            onClick={() => setChartType('line')}
            style={{
              ...styles.tvToolBtn,
              backgroundColor: chartType === 'line' ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
              color: chartType === 'line' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Línea"
          >
            📉 Línea
          </button>
          <button
            onClick={() => setChartType('area')}
            style={{
              ...styles.tvToolBtn,
              backgroundColor: chartType === 'area' ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
              color: chartType === 'area' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Área"
          >
            📊 Área
          </button>
        </div>

        <div style={styles.tvDivider} />

        {/* ELLIOTT WAVE INTEGRATION BUTTON */}
        <button
          onClick={() => {
            setShowElliottWaves(!showElliottWaves);
            if (!showElliottWaves) setActiveTool('elliott');
          }}
          style={{
            ...styles.elliottWaveBtn,
            background: showElliottWaves
              ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)'
              : 'rgba(0, 242, 254, 0.1)',
            color: showElliottWaves ? '#000000' : '#00f2fe',
            border: showElliottWaves ? 'none' : '1px solid #00f2fe',
            boxShadow: showElliottWaves ? '0 0 16px rgba(0, 242, 254, 0.5)' : 'none',
          }}
          title="Activar Análisis Fractal de Ondas de Elliott"
        >
          <span style={{ fontSize: '1rem' }}>🌊</span>
          <span>Elliott Waves</span>
          {showElliottWaves && <span style={styles.badgeActive}>ON</span>}
        </button>

        <div style={styles.tvDivider} />

        {/* Indicator Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            fx Indicadores:
          </span>
          <button
            onClick={() => setShowVolume(!showVolume)}
            style={{
              ...styles.tvPillBtn,
              backgroundColor: showVolume ? '#26a69a' : 'transparent',
              color: showVolume ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Volumen
          </button>
          <button
            onClick={() => setShowSMA20(!showSMA20)}
            style={{
              ...styles.tvPillBtn,
              backgroundColor: showSMA20 ? '#ff9800' : 'transparent',
              color: showSMA20 ? '#fff' : 'var(--text-secondary)',
            }}
          >
            SMA 20
          </button>
          <button
            onClick={() => setShowSMA50(!showSMA50)}
            style={{
              ...styles.tvPillBtn,
              backgroundColor: showSMA50 ? '#2196f3' : 'transparent',
              color: showSMA50 ? '#fff' : 'var(--text-secondary)',
            }}
          >
            SMA 50
          </button>
          <button
            onClick={() => setShowSMA200(!showSMA200)}
            style={{
              ...styles.tvPillBtn,
              backgroundColor: showSMA200 ? '#9c27b0' : 'transparent',
              color: showSMA200 ? '#fff' : 'var(--text-secondary)',
            }}
          >
            SMA 200
          </button>
        </div>

        {/* Right Toggle for Watchlist */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            style={{
              ...styles.tvToolBtn,
              backgroundColor: showWatchlist ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
              color: showWatchlist ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Mostrar/Ocultar Lista de Seguimiento (Watchlist)"
          >
            📋 Watchlist
          </button>
        </div>
      </header>

      {/* BIG PROMINENT MOCK DATA WARNING BANNER */}
      {isMockData && (
        <div
          style={{
            backgroundColor: '#FFE600',
            color: '#000000',
            padding: '10px 16px',
            fontSize: '0.82rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #E6CF00',
            zIndex: 30,
            boxShadow: '0 2px 8px rgba(255, 230, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                MODO SIMULACIÓN / MOCK DATA ACTIVO (TICKER: {symbol})
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, opacity: 0.9 }}>
                Yahoo Finance no responde directamente en navegadores por restricciones de origen (CORS). Se muestran velas de prueba sintéticas ({providerUsed}).
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85 }}>
              💡 Probá tickers Crypto (BTC, ETH) o usá la app nativa de Tauri para cotizaciones de acciones en vivo.
            </span>
            <span
              style={{
                padding: '4px 10px',
                backgroundColor: '#000000',
                color: '#FFE600',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
              }}
            >
              MOCK SIMULATION
            </span>
          </div>
        </div>
      )}

      {/* Main Body Grid */}
      <div style={styles.tvBody}>
        {/* Left Vertical Toolbar */}
        <aside style={styles.tvLeftBar}>
          <button
            onClick={() => setActiveTool('crosshair')}
            style={{
              ...styles.tvLeftBtn,
              backgroundColor: activeTool === 'crosshair' ? 'rgba(41, 98, 255, 0.2)' : 'transparent',
              color: activeTool === 'crosshair' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Mira / Crosshair (┼)"
          >
            ┼
          </button>
          <button
            onClick={() => setActiveTool('trendline')}
            style={{
              ...styles.tvLeftBtn,
              backgroundColor: activeTool === 'trendline' ? 'rgba(41, 98, 255, 0.2)' : 'transparent',
              color: activeTool === 'trendline' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Línea de Tendencia (↗)"
          >
            ↗
          </button>
          <button
            onClick={() => setActiveTool('fibo')}
            style={{
              ...styles.tvLeftBtn,
              backgroundColor: activeTool === 'fibo' ? 'rgba(41, 98, 255, 0.2)' : 'transparent',
              color: activeTool === 'fibo' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Retroceso de Fibonacci (📐)"
          >
            📐
          </button>
          <button
            onClick={() => {
              setActiveTool('elliott');
              setShowElliottWaves(true);
            }}
            style={{
              ...styles.tvLeftBtn,
              backgroundColor: activeTool === 'elliott' || showElliottWaves ? 'rgba(0, 242, 254, 0.25)' : 'transparent',
              color: activeTool === 'elliott' || showElliottWaves ? '#00f2fe' : 'var(--text-primary)',
              border: showElliottWaves ? '1px solid #00f2fe' : 'none',
            }}
            title="Ondas de Elliott (🌊)"
          >
            🌊
          </button>
          <button
            onClick={() => setActiveTool('measure')}
            style={{
              ...styles.tvLeftBtn,
              backgroundColor: activeTool === 'measure' ? 'rgba(41, 98, 255, 0.2)' : 'transparent',
              color: activeTool === 'measure' ? '#2962ff' : 'var(--text-primary)',
            }}
            title="Regla de Medición (📏)"
          >
            📏
          </button>
        </aside>

        {/* Main Chart Canvas Area */}
        <div style={styles.tvChartContainer}>
          {/* Legend Overlay */}
          {activeBar && (
            <div style={styles.tvLegendOverlay}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {symbol} · {timeframe.toUpperCase()}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                O: <strong style={{ color: 'var(--text-primary)' }}>{activeBar.open.toFixed(2)}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                H: <strong style={{ color: '#089981' }}>{activeBar.high.toFixed(2)}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                L: <strong style={{ color: '#f23645' }}>{activeBar.low.toFixed(2)}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                C: <strong style={{ color: 'var(--text-primary)' }}>{activeBar.close.toFixed(2)}</strong>
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: changeVal >= 0 ? '#089981' : '#f23645',
                  marginLeft: '6px',
                }}
              >
                {changeVal >= 0 ? '+' : ''}
                {changeVal.toFixed(2)} ({changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%)
              </span>
            </div>
          )}

          {/* ELLIOTT WAVE OVERLAY */}
          {showElliottWaves && (
            <div style={styles.elliottCardOverlay}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🌊</span>
                  <strong style={{ fontSize: '0.85rem', color: '#00f2fe' }}>EWT Engine: {symbol}</strong>
                </div>
                <button
                  onClick={handleRecountWaves}
                  disabled={recountingWaves}
                  style={styles.recountBtn}
                  title="Recalcular conteo de ondas"
                >
                  {recountingWaves ? '⏳' : '🔄 Recuentar'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Estructura: </span>
                  <strong style={{ color: '#00e676' }}>Impulso (W3 Activa)</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Target Fibo: </span>
                  <strong style={{ color: '#ffeb3b' }}>
                    ${lastBar ? (lastBar.close * 1.085).toFixed(2) : '-'} (+8.5%)
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Confianza: </span>
                  <strong style={{ color: '#00f2fe' }}>88% (Alta)</strong>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div style={styles.tvLoadingOverlay}>
              <span>🔄 Cargando datos...</span>
            </div>
          )}

          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Right Watchlist Sidebar */}
        {showWatchlist && (
          <aside style={styles.tvRightBar}>
            <div style={styles.tvWatchlistHeader}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Catálogo & Watchlist
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {ASSET_CATALOG.length} Referencias
              </span>
            </div>

            <div style={styles.tvWatchlistItems}>
              {ASSET_CATALOG.map((item) => {
                const isSelected = symbol === item.symbol;
                return (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelectAsset(item.symbol)}
                    style={{
                      ...styles.tvWatchlistItem,
                      backgroundColor: isSelected ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #2962ff' : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: '1rem', marginRight: '8px' }}>{item.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {item.symbol}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.category}</span>
                    </div>

                    <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {isSelected && lastBar ? `$${lastBar.close.toFixed(2)}` : 'Ver'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function generateMockWaves(sym: string): WaveLabel[] {
  return [
    { symbol: sym, wave_degree: 'Minor', wave_label: '1', start_date: '2026-03-01', confidence: 0.85, price_start: 500 },
    { symbol: sym, wave_degree: 'Minor', wave_label: '2', start_date: '2026-04-15', confidence: 0.82, price_start: 490 },
    { symbol: sym, wave_degree: 'Minor', wave_label: '3', start_date: '2026-06-10', confidence: 0.91, price_start: 540 },
    { symbol: sym, wave_degree: 'Minor', wave_label: '4', start_date: '2026-07-20', confidence: 0.78, price_start: 525 },
    { symbol: sym, wave_degree: 'Minor', wave_label: '5', start_date: '2026-08-15', confidence: 0.88, price_start: 560 },
  ];
}

function generateMockBars(sym: string, tf: string): OHLCVBar[] {
  const count = tf === '1m' ? 30 : tf === '3m' ? 90 : tf === '1y' ? 250 : 500;
  const bars: OHLCVBar[] = [];
  let basePrice = sym === 'BTC' ? 66500 : sym === 'NVDA' ? 128 : sym === 'AAPL' ? 224 : 545;

  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    const change = (Math.random() - 0.485) * (basePrice * 0.018);
    const open = basePrice;
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.008);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.008);
    const volume = Math.floor(Math.random() * 8000000 + 2000000);

    bars.push({
      symbol: sym,
      date: dateStr,
      open,
      high,
      low,
      close,
      volume,
    });

    basePrice = close;
  }

  return bars;
}

const styles: Record<string, React.CSSProperties> = {
  tvWorkspace: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  tvTopBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    gap: '10px',
    flexWrap: 'wrap',
  },
  symbolBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'rgba(41, 98, 255, 0.12)',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  tvSearchInput: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    width: '240px',
  },
  autocompleteDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    width: '380px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  categoryTabs: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
  },
  categoryTabBtn: {
    padding: '4px 8px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  catalogItemsList: {
    maxHeight: '280px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  catalogItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  tagExchange: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  tagCategory: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#2962ff',
    backgroundColor: 'rgba(41, 98, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  tvDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'var(--border)',
  },
  tvToolBtn: {
    padding: '5px 10px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  elliottWaveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  badgeActive: {
    padding: '1px 5px',
    backgroundColor: '#000',
    color: '#00f2fe',
    borderRadius: '3px',
    fontSize: '0.65rem',
    fontWeight: 900,
  },
  tvPillBtn: {
    padding: '3px 8px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tvBody: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  tvLeftBar: {
    width: '46px',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '6px',
  },
  tvLeftBtn: {
    width: '34px',
    height: '34px',
    border: 'none',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tvChartContainer: {
    flex: 1,
    position: 'relative',
    height: '100%',
  },
  tvLegendOverlay: {
    position: 'absolute',
    top: '12px',
    left: '14px',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'rgba(19, 23, 34, 0.75)',
    backdropFilter: 'blur(4px)',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    border: '1px solid var(--border)',
  },
  elliottCardOverlay: {
    position: 'absolute',
    top: '50px',
    left: '14px',
    zIndex: 10,
    backgroundColor: 'rgba(19, 23, 34, 0.88)',
    backdropFilter: 'blur(8px)',
    border: '1px solid #00f2fe',
    borderRadius: '8px',
    padding: '10px 14px',
    boxShadow: '0 8px 24px rgba(0, 242, 254, 0.25)',
    minWidth: '340px',
  },
  recountBtn: {
    padding: '2px 8px',
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    color: '#00f2fe',
    border: '1px solid #00f2fe',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tvLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '1rem',
  },
  tvRightBar: {
    width: '240px',
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  tvWatchlistHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tvWatchlistItems: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  tvWatchlistItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    transition: 'background-color 0.15s ease',
  },
};
