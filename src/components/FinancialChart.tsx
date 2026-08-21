import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useUIStore } from '@/store/uiStore';

export interface ChartMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
}

export interface LineOverlay {
  name: string;
  color: string;
  lineWidth?: number;
  data: { time: string; value: number }[];
}

export interface FinancialChartProps {
  type?: 'candlestick' | 'line' | 'area';
  data: CandlestickData<Time>[] | LineData<Time>[];
  overlays?: LineOverlay[];
  markers?: ChartMarker[];
  height?: number;
  autoFit?: boolean;
}

export function FinancialChart({
  type = 'candlestick',
  data,
  overlays = [],
  markers = [],
  height = 400,
  autoFit = true,
}: FinancialChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';
    const bg = isDark ? '#1a1d24' : '#ffffff';
    const textColor = isDark ? '#a0aec0' : '#4a5568';
    const gridColor = isDark ? '#2d3748' : '#edf2f7';
    const borderColor = isDark ? '#4a5568' : '#e2e8f0';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: textColor,
        fontSize: 12,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>;

    if (type === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#4caf50',
        downColor: '#f44336',
        borderVisible: false,
        wickUpColor: '#4caf50',
        wickDownColor: '#f44336',
      });
    } else if (type === 'area') {
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(33, 150, 243, 0.4)',
        bottomColor: 'rgba(33, 150, 243, 0.0)',
        lineColor: '#2196f3',
        lineWidth: 2,
      });
    } else {
      mainSeries = chart.addLineSeries({
        color: '#2196f3',
        lineWidth: 2,
      });
    }

    mainSeriesRef.current = mainSeries;

    if (data && data.length > 0) {
      mainSeries.setData(data as any);
    }

    // Add overlays
    overlaySeriesRef.current = overlays.map((overlay) => {
      const lineSeries = chart.addLineSeries({
        color: overlay.color,
        lineWidth: (overlay.lineWidth ?? 2) as any,
        title: overlay.name,
      });
      lineSeries.setData(overlay.data as any);
      return lineSeries;
    });

    // Add markers
    if (markers.length > 0 && mainSeries.setMarkers) {
      mainSeries.setMarkers(markers as unknown as SeriesMarker<Time>[]);
    }

    if (autoFit && data && data.length > 0) {
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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
      overlaySeriesRef.current = [];
    };
  }, [theme, type, height]);

  // Update data & markers when props change
  useEffect(() => {
    if (!mainSeriesRef.current || !data) return;
    mainSeriesRef.current.setData(data as any);

    if (markers.length > 0 && mainSeriesRef.current.setMarkers) {
      mainSeriesRef.current.setMarkers(markers as unknown as SeriesMarker<Time>[]);
    }

    if (autoFit && chartRef.current && data.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, markers, autoFit]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
