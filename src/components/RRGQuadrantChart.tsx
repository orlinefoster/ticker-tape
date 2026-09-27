import React, { useState } from 'react';

export type RRGQuadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';

export interface RRGDataPoint {
  symbol: string;
  x: number; // RS-Ratio - 100
  y: number; // RM - 100
  history: { x: number; y: number; date: string }[];
  category?: string;
  heading?: number; // Heading angle in degrees 0° - 360°
  headingArrow?: string; // e.g. ↗, ↘, ↖, ↙
  velocity?: number; // Distance traveled
  quadrant?: RRGQuadrant;
}

interface RRGQuadrantChartProps {
  points: RRGDataPoint[];
  benchmarkSymbol?: string;
  availableBenchmarks?: string[];
  onChangeBenchmark?: (symbol: string) => void;
  tailLength?: number;
  availableTailLengths?: number[];
  onChangeTailLength?: (len: number) => void;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
  hoveredSymbol?: string | null;
  onHoverSymbol?: (symbol: string | null) => void;
}

export function RRGQuadrantChart({
  points,
  benchmarkSymbol = 'SPY',
  availableBenchmarks = [],
  onChangeBenchmark,
  tailLength = 30,
  availableTailLengths = [5, 10, 15, 20, 30, 45, 60, 90],
  onChangeTailLength,
  onSelectSymbol,
  selectedSymbol,
  hoveredSymbol: externalHovered,
  onHoverSymbol,
}: RRGQuadrantChartProps) {
  const [internalHovered, setInternalHovered] = useState<string | null>(null);
  const hoveredSymbol = externalHovered !== undefined ? externalHovered : internalHovered;

  const handleHover = (sym: string | null) => {
    setInternalHovered(sym);
    if (onHoverSymbol) onHoverSymbol(sym);
  };

  const [fitMode, setFitMode] = useState<'close' | 'all'>('close');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // In close/focus mode, we calculate limits based on current head positions & last 5 trail points
  const activeAbsX = Math.max(
    ...points.map((p) => Math.abs(p.x)),
    ...points.flatMap((p) => p.history.slice(-5).map((h) => Math.abs(h.x))),
    1.5
  );
  const activeAbsY = Math.max(
    ...points.map((p) => Math.abs(p.y)),
    ...points.flatMap((p) => p.history.slice(-5).map((h) => Math.abs(h.y))),
    1.5
  );

  const fullAbsX = Math.max(
    ...points.flatMap((p) => [Math.abs(p.x), ...p.history.map((h) => Math.abs(h.x))]),
    3.0
  );
  const fullAbsY = Math.max(
    ...points.flatMap((p) => [Math.abs(p.y), ...p.history.map((h) => Math.abs(h.y))]),
    3.0
  );

  const baseLimitX = fitMode === 'close' ? activeAbsX * 1.25 : fullAbsX * 1.25;
  const baseLimitY = fitMode === 'close' ? activeAbsY * 1.25 : fullAbsY * 1.25;

  const limitX = Math.max(0.5, Number((baseLimitX / zoomLevel).toFixed(2)));
  const limitY = Math.max(0.5, Number((baseLimitY / zoomLevel).toFixed(2)));

  // SVG dimensions (increased by 50%)
  const svgWidth = 960;
  const svgHeight = 720;
  const padding = 65;
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
    '#00e676',
  ];

  // Count items per quadrant
  const quadrantCounts = points.reduce<Record<RRGQuadrant, number>>(
    (acc, pt) => {
      const q = pt.quadrant || (pt.x >= 0 ? (pt.y >= 0 ? 'Leading' : 'Weakening') : (pt.y >= 0 ? 'Improving' : 'Lagging'));
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    },
    { Leading: 0, Weakening: 0, Lagging: 0, Improving: 0 }
  );

  const activePoint = points.find((p) => p.symbol === (hoveredSymbol || selectedSymbol));

  return (
    <div className="cyber-card" style={styles.cardContainer}>
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={styles.title}>Relative Rotation Graph (RRG) 🔄</h3>
            {availableBenchmarks.length > 1 && onChangeBenchmark ? (
              <div style={styles.benchmarkSelector}>
                <span style={styles.benchLabel}>Benchmark:</span>
                <select
                  value={benchmarkSymbol}
                  onChange={(e) => onChangeBenchmark(e.target.value)}
                  style={styles.select}
                  aria-label="Seleccionar Benchmark"
                >
                  {availableBenchmarks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span style={styles.benchBadge}>Benchmark: {benchmarkSymbol}</span>
            )}

            {onChangeTailLength && (
              <div style={styles.benchmarkSelector}>
                <span style={styles.benchLabel}>Estela / Cola:</span>
                <select
                  value={tailLength}
                  onChange={(e) => onChangeTailLength(Number(e.target.value))}
                  style={styles.select}
                  aria-label="Seleccionar temporalidad de cola"
                >
                  {availableTailLengths.map((len) => (
                    <option key={len} value={len}>
                      {len} períodos ({len}d)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p style={styles.subtitle}>
            Rotación de fuerza relativa (RS-Ratio en X) y momentum (RS-Momentum en Y) contra {benchmarkSymbol} · Estela histórica visible de {tailLength} períodos
          </p>
        </div>

        {/* Quadrant Legend & Zoom Toolbar */}
        <div style={styles.topRightControls}>
          <div style={styles.zoomToolbar}>
            <button
              onClick={() => setFitMode((m) => (m === 'close' ? 'all' : 'close'))}
              style={{
                ...styles.zoomBtn,
                backgroundColor: fitMode === 'close' ? 'var(--accent)' : 'var(--bg-primary)',
                color: fitMode === 'close' ? '#ffffff' : 'var(--text-primary)',
                borderColor: fitMode === 'close' ? 'var(--accent)' : 'var(--border)',
              }}
              title="Ajustar cuadrantes de forma cercana a los datos activos para máxima claridad"
            >
              {fitMode === 'close' ? '🎯 Auto-Fit (Cercano)' : '🌐 Vista Completa'}
            </button>
            <div style={styles.zoomButtonGroup}>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                style={styles.zoomStepBtn}
                title="Alejar Zoom (-25%)"
              >
                −
              </button>
              <span style={styles.zoomLabel}>{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                style={styles.zoomStepBtn}
                title="Acercar Zoom (+25%)"
              >
                +
              </button>
              {zoomLevel !== 1.0 && (
                <button
                  onClick={() => setZoomLevel(1.0)}
                  style={styles.zoomResetBtn}
                  title="Restablecer Zoom al 100%"
                >
                  ↺ 100%
                </button>
              )}
            </div>
            <span style={styles.scaleBadge}>
              ±{limitX} X | ±{limitY} Y
            </span>
          </div>

          <div style={styles.quadrantLegend}>
            <span style={{ ...styles.pill, backgroundColor: 'rgba(76, 175, 80, 0.15)', color: '#4caf50' }}>
              🟢 Leading ({quadrantCounts.Leading})
            </span>
            <span style={{ ...styles.pill, backgroundColor: 'rgba(255, 152, 0, 0.15)', color: '#ff9800' }}>
              🟡 Weakening ({quadrantCounts.Weakening})
            </span>
            <span style={{ ...styles.pill, backgroundColor: 'rgba(244, 67, 54, 0.15)', color: '#f44336' }}>
              🔴 Lagging ({quadrantCounts.Lagging})
            </span>
            <span style={{ ...styles.pill, backgroundColor: 'rgba(33, 150, 243, 0.15)', color: '#2196f3' }}>
              🔵 Improving ({quadrantCounts.Improving})
            </span>
          </div>
        </div>
      </div>

      <div style={styles.svgWrapper}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <defs>
            <clipPath id="rrgChartClip">
              <rect x={padding} y={padding} width={chartW} height={chartH} />
            </clipPath>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Quadrants */}
          {/* Top-Right: Leading (+X, +Y) */}
          <rect
            x={cx}
            y={padding}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(76, 175, 80, 0.06)"
          />
          {/* Bottom-Right: Weakening (+X, -Y) */}
          <rect
            x={cx}
            y={cy}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(255, 152, 0, 0.06)"
          />
          {/* Bottom-Left: Lagging (-X, -Y) */}
          <rect
            x={padding}
            y={cy}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(244, 67, 54, 0.06)"
          />
          {/* Top-Left: Improving (-X, +Y) */}
          <rect
            x={padding}
            y={padding}
            width={chartW / 2}
            height={chartH / 2}
            fill="rgba(33, 150, 243, 0.06)"
          />

          {/* Quadrant Titles in Background */}
          <text x={cx + 18} y={padding + 26} fill="#4caf50" opacity={0.35} fontSize="13" fontWeight="800">
            LEADING (Líder) ↗
          </text>
          <text x={cx + 18} y={cy + chartH / 2 - 18} fill="#ff9800" opacity={0.35} fontSize="13" fontWeight="800">
            WEAKENING (Debilitándose) ↘
          </text>
          <text x={padding + 18} y={cy + chartH / 2 - 18} fill="#f44336" opacity={0.35} fontSize="13" fontWeight="800">
            LAGGING (Rezagado) ↙
          </text>
          <text x={padding + 18} y={padding + 26} fill="#2196f3" opacity={0.35} fontSize="13" fontWeight="800">
            IMPROVING (Mejorando) ↖
          </text>

          {/* Rotation Guide Ring Arrow (Clockwise) */}
          <circle
            cx={cx}
            cy={cy}
            r={chartW * 0.38}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 6"
            opacity={0.35}
          />

          {/* Center Crosshair Axes (0, 0) */}
          <line x1={cx} y1={padding} x2={cx} y2={svgHeight - padding} stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1={padding} y1={cy} x2={svgWidth - padding} y2={cy} stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Center Benchmark Point (0,0) */}
          <circle cx={cx} cy={cy} r={4} fill="var(--text-secondary)" opacity={0.6} />
          <text x={cx + 6} y={cy - 6} fill="var(--text-secondary)" fontSize="10" fontWeight="600" opacity={0.7}>
            {benchmarkSymbol} (100, 100)
          </text>

          {/* Axis Labels */}
          <text x={svgWidth - padding + 4} y={cy + 4} fill="var(--text-secondary)" fontSize="11" fontWeight="600">
            + RS-Ratio (X)
          </text>
          <text x={cx - 50} y={padding - 10} fill="var(--text-secondary)" fontSize="11" fontWeight="600">
            + RS-Momentum (Y)
          </text>

          {/* Asset Trail Lines & Node Points (Clipped to chart bounds) */}
          <g clipPath="url(#rrgChartClip)">
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
                  onMouseEnter={() => handleHover(pt.symbol)}
                  onMouseLeave={() => handleHover(null)}
                  onClick={() => onSelectSymbol && onSelectSymbol(pt.symbol)}
                  style={{ cursor: 'pointer' }}
                  filter={active ? 'url(#glow)' : undefined}
                >
                  {/* Trail Line */}
                  {dStr && (
                    <path
                      d={dStr}
                      fill="none"
                      stroke={color}
                      strokeWidth={active ? 3.5 : 1.75}
                      opacity={active ? 1.0 : 0.45}
                    />
                  )}

                  {/* History tail dots */}
                  {pt.history.map((h, hIdx) => (
                    <circle
                      key={hIdx}
                      cx={toSvgX(h.x)}
                      cy={toSvgY(h.y)}
                      r={active ? 2.5 : 1.75}
                      fill={color}
                      opacity={0.25 + (hIdx / pt.history.length) * 0.55}
                    />
                  ))}

                  {/* Main Current Head Circle */}
                  <circle
                    cx={currX}
                    cy={currY}
                    r={active ? 9 : 6.5}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={active ? 2.5 : 1.5}
                  />

                  {/* Label Badge */}
                  <rect
                    x={currX + 9}
                    y={currY - 11}
                    width={pt.symbol.length * 8 + (pt.headingArrow ? 24 : 14)}
                    height="20"
                    rx="4"
                    fill={active ? color : 'var(--bg-secondary)'}
                    stroke={color}
                    strokeWidth={active ? 1.5 : 1}
                    opacity={active ? 1 : 0.85}
                  />
                  <text
                    x={currX + 15}
                    y={currY + 3}
                    fill={active ? '#ffffff' : 'var(--text-primary)'}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {pt.symbol} {pt.headingArrow || ''}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Active Hover / Selection Info Overlay HUD */}
          {activePoint && (
            <g transform={`translate(${padding + 10}, ${svgHeight - padding - 60})`}>
              <rect
                x="0"
                y="0"
                width="220"
                height="56"
                rx="6"
                fill="var(--bg-secondary)"
                stroke="var(--accent)"
                strokeWidth="1.5"
                opacity="0.95"
              />
              <text x="12" y="20" fill="var(--text-primary)" fontSize="12" fontWeight="800">
                {activePoint.symbol} ({activePoint.quadrant || 'Alpha'})
              </text>
              <text x="12" y="36" fill="var(--text-secondary)" fontSize="11" fontFamily="JetBrains Mono, monospace">
                RS-Ratio: {(100 + activePoint.x).toFixed(1)} | RM: {(100 + activePoint.y).toFixed(1)}
              </text>
              <text x="12" y="49" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                Rumbo: {activePoint.heading !== undefined ? `${activePoint.heading}° ${activePoint.headingArrow}` : '—'} | Vel: {activePoint.velocity?.toFixed(2) ?? '—'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    backgroundColor: 'var(--bg-surface-elevated, var(--bg-secondary))',
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
  benchmarkSelector: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'var(--bg-primary)',
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
  benchLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  select: {
    backgroundColor: 'transparent',
    color: 'var(--accent)',
    border: 'none',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    outline: 'none',
  },
  benchBadge: {
    padding: '2px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent)',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  topRightControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
  },
  zoomToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  zoomBtn: {
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  zoomButtonGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  zoomStepBtn: {
    padding: '3px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  zoomLabel: {
    padding: '0 6px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    fontFamily: 'JetBrains Mono, monospace',
  },
  zoomResetBtn: {
    padding: '3px 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeft: '1px solid var(--border)',
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    cursor: 'pointer',
  },
  scaleBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #64748B)',
    fontFamily: 'JetBrains Mono, monospace',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: '2px 6px',
    borderRadius: '4px',
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
    height: '720px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
};
