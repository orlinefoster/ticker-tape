import { useState } from 'react';

export interface RRGDataPoint {
  symbol: string;
  x: number; // RS-Ratio - 100
  y: number; // RM - 100
  history: { x: number; y: number; date: string }[];
  category?: string;
}

interface RRGQuadrantChartProps {
  points: RRGDataPoint[];
  benchmarkSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
}

export function RRGQuadrantChart({
  points,
  benchmarkSymbol = 'SPY',
  onSelectSymbol,
  selectedSymbol,
}: RRGQuadrantChartProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Determine dynamic axis range based on max values
  const maxAbsX = Math.max(
    ...points.flatMap((p) => [Math.abs(p.x), ...p.history.map((h) => Math.abs(h.x))]),
    5
  );
  const maxAbsY = Math.max(
    ...points.flatMap((p) => [Math.abs(p.y), ...p.history.map((h) => Math.abs(h.y))]),
    5
  );

  const limitX = Math.ceil(maxAbsX * 1.2);
  const limitY = Math.ceil(maxAbsY * 1.2);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 460;
  const padding = 50;
  const chartW = svgWidth - padding * 2;
  const chartH = svgHeight - padding * 2;
  const cx = padding + chartW / 2;
  const cy = padding + chartH / 2;

  // Convert (x, y) mathematical coordinate to SVG (px, py)
  const toSvgX = (x: number) => cx + (x / limitX) * (chartW / 2);
  const toSvgY = (y: number) => cy - (y / limitY) * (chartH / 2);

  const colors = [
    '#2196f3',
    '#4caf50',
    '#ff9800',
    '#9c27b0',
    '#e91e63',
    '#00bcd4',
    '#ff5722',
    '#795548',
    '#607d8b',
  ];

  return (
    <div style={styles.cardContainer}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Relative Rotation Graph (RRG) 🔄</h3>
          <p style={styles.subtitle}>
            Matriz de Cuadrantes de Rotación de Activos respecto a Benchmark ({benchmarkSymbol})
          </p>
        </div>

        {/* Quadrant Legend Pill */}
        <div style={styles.quadrantLegend}>
          <span style={{ ...styles.pill, backgroundColor: 'rgba(76, 175, 80, 0.15)', color: '#4caf50' }}>
            🟢 Leading (+X, +Y)
          </span>
          <span style={{ ...styles.pill, backgroundColor: 'rgba(255, 152, 0, 0.15)', color: '#ff9800' }}>
            🟡 Weakening (+X, -Y)
          </span>
          <span style={{ ...styles.pill, backgroundColor: 'rgba(244, 67, 54, 0.15)', color: '#f44336' }}>
            🔴 Lagging (-X, -Y)
          </span>
          <span style={{ ...styles.pill, backgroundColor: 'rgba(33, 150, 243, 0.15)', color: '#2196f3' }}>
            🔵 Improving (-X, +Y)
          </span>
        </div>
      </div>

      <div style={styles.svgWrapper}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Background Quadrants */}
          {/* Top-Right: Leading (+X, +Y) */}
          <rect
            x={cx}
            y={padding}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(76, 175, 80, 0.05)"
          />
          {/* Bottom-Right: Weakening (+X, -Y) */}
          <rect
            x={cx}
            y={cy}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(255, 152, 0, 0.05)"
          />
          {/* Bottom-Left: Lagging (-X, -Y) */}
          <rect
            x={padding}
            y={cy}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(244, 67, 54, 0.05)"
          />
          {/* Top-Left: Improving (-X, +Y) */}
          <rect
            x={padding}
            y={padding}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(33, 150, 243, 0.05)"
          />

          {/* Quadrant Titles in Background */}
          <text x={cx + 20} y={padding + 30} fill="#4caf50" opacity={0.35} fontSize="14" fontWeight="800">
            LEADING (Líder)
          </text>
          <text x={cx + 20} y={cy + chartH / 2 - 20} fill="#ff9800" opacity={0.35} fontSize="14" fontWeight="800">
            WEAKENING (Debilitando)
          </text>
          <text x={padding + 20} y={cy + chartH / 2 - 20} fill="#f44336" opacity={0.35} fontSize="14" fontWeight="800">
            LAGGING (Rezagado)
          </text>
          <text x={padding + 20} y={padding + 30} fill="#2196f3" opacity={0.35} fontSize="14" fontWeight="800">
            IMPROVING (Mejorando)
          </text>

          {/* Center Crosshair Axes (0, 0) */}
          <line x1={cx} y1={padding} x2={cx} y2={svgHeight - padding} stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
          <line x1={padding} y1={cy} x2={svgWidth - padding} y2={cy} stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />

          {/* Axis Labels */}
          <text x={svgWidth - padding + 5} y={cy + 4} fill="var(--text-secondary)" fontSize="11" fontWeight="600">
            + RS-Ratio (X)
          </text>
          <text x={cx - 40} y={padding - 10} fill="var(--text-secondary)" fontSize="11" fontWeight="600">
            + RM Momentum (Y)
          </text>

          {/* Asset Trail Lines & Node Points */}
          {points.map((pt, idx) => {
            const color = colors[idx % colors.length];
            const isHovered = hoveredSymbol === pt.symbol;
            const isSelected = selectedSymbol === pt.symbol;
            const active = isHovered || isSelected;

            const currX = toSvgX(pt.x);
            const currY = toSvgY(pt.y);

            // Construct Trail Path string
            const pathPoints = [
              ...pt.history.map((h) => `${toSvgX(h.x)},${toSvgY(h.y)}`),
              `${currX},${currY}`,
            ];
            const dStr = pathPoints.length > 1 ? `M ${pathPoints.join(' L ')}` : '';

            return (
              <g
                key={pt.symbol}
                onMouseEnter={() => setHoveredSymbol(pt.symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                onClick={() => onSelectSymbol && onSelectSymbol(pt.symbol)}
                style={{ cursor: 'pointer' }}
              >
                {/* Trail Line */}
                {dStr && (
                  <path
                    d={dStr}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? 3 : 1.5}
                    opacity={active ? 0.9 : 0.4}
                  />
                )}

                {/* History tail dots */}
                {pt.history.map((h, hIdx) => (
                  <circle
                    key={hIdx}
                    cx={toSvgX(h.x)}
                    cy={toSvgY(h.y)}
                    r={2}
                    fill={color}
                    opacity={0.3 + (hIdx / pt.history.length) * 0.4}
                  />
                ))}

                {/* Main Current Head Circle */}
                <circle
                  cx={currX}
                  cy={currY}
                  r={active ? 8 : 6}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Label Badge */}
                <rect
                  x={currX + 8}
                  y={currY - 10}
                  width={pt.symbol.length * 8 + 12}
                  height="18"
                  rx="4"
                  fill={active ? color : 'var(--bg-secondary)'}
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  x={currX + 14}
                  y={currY + 3}
                  fill={active ? '#ffffff' : 'var(--text-primary)'}
                  fontSize="11"
                  fontWeight="700"
                >
                  {pt.symbol}
                </text>
              </g>
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
    padding: '20px',
    border: '1px solid var(--border)',
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  quadrantLegend: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  pill: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  svgWrapper: {
    width: '100%',
    height: '460px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
};
