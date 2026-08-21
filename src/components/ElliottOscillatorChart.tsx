import { useMemo } from 'react';
import { type OHLCVBar } from '@/lib/tauri';

interface ElliottOscillatorChartProps {
  bars: OHLCVBar[];
  symbol: string;
  height?: number;
}

export function ElliottOscillatorChart({ bars, symbol, height = 220 }: ElliottOscillatorChartProps) {
  // Calculate Elliott Oscillator (5, 35)
  const oscData = useMemo(() => {
    if (!bars || bars.length < 35) return [];

    // Calculate Typical Price TP
    const tpArray = bars.map((b) => (b.high + b.low + b.close) / 3);

    const result: { date: string; value: number; color: string }[] = [];

    for (let i = 34; i < bars.length; i++) {
      // 5-period SMA
      const slice5 = tpArray.slice(i - 4, i + 1);
      const sma5 = slice5.reduce((a, b) => a + b, 0) / 5;

      // 35-period SMA
      const slice35 = tpArray.slice(i - 34, i + 1);
      const sma35 = slice35.reduce((a, b) => a + b, 0) / 35;

      const osc = sma5 - sma35;

      result.push({
        date: bars[i].date,
        value: Number(osc.toFixed(4)),
        color: osc >= 0 ? '#00e676' : '#ff1744',
      });
    }

    return result;
  }, [bars]);

  if (!oscData.length) {
    return (
      <div style={styles.cardContainer}>
        <h4 style={styles.title}>Oscilador de Elliott (35, 5) — {symbol}</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Se requieren al menos 35 datos históricos para calcular el oscilador.
        </p>
      </div>
    );
  }

  // Find max amplitude for SVG scale
  const maxVal = Math.max(...oscData.map((d) => Math.abs(d.value)), 1);

  const svgWidth = 700;
  const svgHeight = height;
  const padding = 30;
  const chartW = svgWidth - padding * 2;
  const chartH = svgHeight - padding * 2;
  const zeroY = padding + chartH / 2;

  const barWidth = Math.max(1, chartW / oscData.length - 1);

  return (
    <div style={styles.cardContainer}>
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>Oscilador de Elliott (35, 5) — {symbol} 🌊</h4>
          <p style={styles.subtitle}>
            `SMA(TP, 5) - SMA(TP, 35)` — Identifica picos de impulso (Onda 3) y divergencias correctivas
          </p>
        </div>
        <span style={styles.badge}>Último: {oscData[oscData.length - 1].value}</span>
      </div>

      <div style={styles.svgWrapper}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Center Zero Line */}
          <line x1={padding} y1={zeroY} x2={svgWidth - padding} y2={zeroY} stroke="var(--border)" strokeWidth="1.5" />

          {/* Histogram Bars */}
          {oscData.map((d, i) => {
            const x = padding + (i / oscData.length) * chartW;
            const barH = (Math.abs(d.value) / maxVal) * (chartH / 2);
            const y = d.value >= 0 ? zeroY - barH : zeroY;

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, barH)}
                fill={d.color}
                opacity={0.85}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '16px 20px',
    border: '1px solid var(--border)',
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '0.78125rem',
    color: 'var(--text-secondary)',
    margin: '2px 0 0',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    color: '#00e676',
  },
  svgWrapper: {
    width: '100%',
    height: '180px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
};
