import React, { useState } from 'react';
import type { RRGDataPoint, RRGQuadrant } from '@/components/RRGQuadrantChart';

export interface RelativeStrength {
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

export type ViewMode = 'heatmap' | 'tiles' | 'classic';

interface RSHeatmapMatrixProps {
  rankings: RelativeStrength[];
  rrgPointMap: Map<string, RRGDataPoint>;
  currentBenchmark: string;
  selectedAsset: string;
  onSelectAsset: (symbol: string) => void;
  hoveredSymbol: string | null;
  onHoverSymbol: (symbol: string | null) => void;
}

const WINDOWS = ['1w', '1m', '3m', '6m', '1y'] as const;

export function getReturnHeatmapColor(val: number): { bg: string; text: string; border: string } {
  if (isNaN(val) || val === 0) {
    return { bg: 'transparent', text: 'var(--text-secondary)', border: 'transparent' };
  }

  const clamped = Math.max(-0.4, Math.min(0.4, val));

  if (clamped > 0) {
    const intensity = Math.min(1, clamped / 0.3); // 0 to 1
    const alpha = (0.12 + intensity * 0.55).toFixed(2);
    return {
      bg: `rgba(16, 185, 129, ${alpha})`,
      text: intensity > 0.5 ? '#ffffff' : '#34d399',
      border: `rgba(16, 185, 129, ${(0.2 + intensity * 0.4).toFixed(2)})`,
    };
  } else {
    const intensity = Math.min(1, Math.abs(clamped) / 0.3);
    const alpha = (0.12 + intensity * 0.55).toFixed(2);
    return {
      bg: `rgba(239, 68, 68, ${alpha})`,
      text: intensity > 0.5 ? '#ffffff' : '#f87171',
      border: `rgba(239, 68, 68, ${(0.2 + intensity * 0.4).toFixed(2)})`,
    };
  }
}

function quadrantBadgeStyle(quadrant: RRGQuadrant): React.CSSProperties {
  switch (quadrant) {
    case 'Leading':
      return { backgroundColor: 'rgba(76, 175, 80, 0.15)', color: '#4caf50', border: '1px solid rgba(76, 175, 80, 0.3)' };
    case 'Weakening':
      return { backgroundColor: 'rgba(255, 152, 0, 0.15)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.3)' };
    case 'Lagging':
      return { backgroundColor: 'rgba(244, 67, 54, 0.15)', color: '#f44336', border: '1px solid rgba(244, 67, 54, 0.3)' };
    case 'Improving':
      return { backgroundColor: 'rgba(33, 150, 243, 0.15)', color: '#2196f3', border: '1px solid rgba(33, 150, 243, 0.3)' };
  }
}

export function RSHeatmapMatrix({
  rankings,
  rrgPointMap,
  currentBenchmark,
  selectedAsset,
  onSelectAsset,
  hoveredSymbol,
  onHoverSymbol,
}: RSHeatmapMatrixProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');

  // Group assets by quadrant for tile view
  const quadrantGroups = {
    Leading: [] as RelativeStrength[],
    Improving: [] as RelativeStrength[],
    Weakening: [] as RelativeStrength[],
    Lagging: [] as RelativeStrength[],
  };

  rankings.forEach((r) => {
    const pt = rrgPointMap.get(r.symbol);
    const q: RRGQuadrant = pt?.quadrant || (r.returns_1m >= 0 ? 'Leading' : 'Lagging');
    quadrantGroups[q].push(r);
  });

  return (
    <div className="cyber-card" style={styles.container}>
      {/* Header with Title and Mode Switcher */}
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={styles.title}>Matriz de Fuerza Relativa & Rumbo (RS Leaderboard)</h3>
            <span style={styles.benchTag}>vs {currentBenchmark}</span>
          </div>
          <p style={styles.subtitle}>
            Mapa térmico multi-ventana con visualización de aceleración de momentum, cuadrantes y rumbos angulares
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div style={styles.modeSwitcher}>
          <button
            onClick={() => setViewMode('heatmap')}
            style={{
              ...styles.modeBtn,
              backgroundColor: viewMode === 'heatmap' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'heatmap' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            🔥 Heatmap Matricial
          </button>
          <button
            onClick={() => setViewMode('tiles')}
            style={{
              ...styles.modeBtn,
              backgroundColor: viewMode === 'tiles' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'tiles' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            🗺️ Mosaico por Cuadrantes
          </button>
          <button
            onClick={() => setViewMode('classic')}
            style={{
              ...styles.modeBtn,
              backgroundColor: viewMode === 'classic' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'classic' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            📋 Tabla Clásica
          </button>
        </div>
      </div>

      {/* Heatmap Legend Bar (Shown on Heatmap mode) */}
      {viewMode === 'heatmap' && (
        <div style={styles.legendBar}>
          <span style={styles.legendLabel}>Escala Térmica:</span>
          <div style={styles.gradientBarWrapper}>
            <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>-30%</span>
            <div style={styles.gradientBar} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>0%</span>
            <div style={styles.gradientBarPositive} />
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>+30%</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            Tip: Clic en cualquier fila para enfocar la curva en el gráfico
          </span>
        </div>
      )}

      {/* 1. HEATMAP MATRIX / CLASSIC TABLE VIEW */}
      {(viewMode === 'heatmap' || viewMode === 'classic') && (
        <div style={{ overflowX: 'auto' }}>
          <table className="institutional-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Símbolo</th>
                <th style={styles.th}>Cuadrante RRG</th>
                <th style={styles.th}>Rumbo</th>
                <th style={styles.th}>Velocidad</th>
                {WINDOWS.map((w) => (
                  <th key={w} style={{ ...styles.th, textAlign: 'center' }}>
                    {w} Ret
                  </th>
                ))}
                <th style={{ ...styles.th, textAlign: 'center' }}>RS Score</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>vs {currentBenchmark} 1m</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>vs {currentBenchmark} 3m</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>vs {currentBenchmark} 6m</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, idx) => {
                const pt = rrgPointMap.get(r.symbol);
                const isSelected = selectedAsset === r.symbol;
                const isHovered = hoveredSymbol === r.symbol;
                const rowActive = isSelected || isHovered;

                return (
                  <tr
                    key={r.symbol}
                    onClick={() => onSelectAsset(r.symbol)}
                    onMouseEnter={() => onHoverSymbol(r.symbol)}
                    onMouseLeave={() => onHoverSymbol(null)}
                    style={{
                      ...styles.tr,
                      cursor: 'pointer',
                      backgroundColor: rowActive ? 'rgba(59, 130, 246, 0.14)' : undefined,
                    }}
                  >
                    <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {r.symbol}
                        {isSelected && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>●</span>}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {pt?.quadrant ? (
                        <span style={{ ...styles.quadrantBadge, ...quadrantBadgeStyle(pt.quadrant) }}>
                          {pt.quadrant}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {pt?.heading !== undefined ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '1rem', color: 'var(--accent)' }}>{pt.headingArrow}</span>
                          {pt.heading}°
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'JetBrains Mono, monospace' }}>
                      {pt?.velocity !== undefined ? pt.velocity.toFixed(2) : '—'}
                    </td>

                    {/* Window Returns with Heatmap formatting */}
                    {WINDOWS.map((w) => {
                      const val = r[`returns_${w}` as keyof RelativeStrength] as number;
                      const heat = getReturnHeatmapColor(val);
                      const isHeatmap = viewMode === 'heatmap';

                      return (
                        <td
                          key={w}
                          style={{
                            ...styles.td,
                            textAlign: 'center',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: isHeatmap ? 600 : 500,
                            backgroundColor: isHeatmap ? heat.bg : 'transparent',
                            color: isHeatmap ? heat.text : val >= 0 ? '#4caf50' : '#f44336',
                            borderLeft: isHeatmap ? `1px solid ${heat.border}` : undefined,
                            borderRight: isHeatmap ? `1px solid ${heat.border}` : undefined,
                          }}
                        >
                          {(val * 100).toFixed(1)}%
                        </td>
                      );
                    })}

                    {/* Composite RS Score */}
                    <td
                      style={{
                        ...styles.td,
                        textAlign: 'center',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        fontFamily: 'JetBrains Mono, monospace',
                        backgroundColor: viewMode === 'heatmap' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      }}
                    >
                      {r.composite_rs.toFixed(0)}
                    </td>

                    {/* vs Benchmark Returns with Heatmap formatting */}
                    {(['1m', '3m', '6m'] as const).map((period) => {
                      const vsKey = `vs_benchmark_${period}` as keyof RelativeStrength;
                      const val = r[vsKey] as number;
                      const heat = getReturnHeatmapColor(val);
                      const isHeatmap = viewMode === 'heatmap';

                      return (
                        <td
                          key={period}
                          style={{
                            ...styles.td,
                            textAlign: 'center',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: isHeatmap ? 600 : 500,
                            backgroundColor: isHeatmap ? heat.bg : 'transparent',
                            color: isHeatmap ? heat.text : val >= 0 ? '#4caf50' : '#f44336',
                            borderLeft: isHeatmap ? `1px solid ${heat.border}` : undefined,
                            borderRight: isHeatmap ? `1px solid ${heat.border}` : undefined,
                          }}
                        >
                          {(val * 100).toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. QUADRANT TILES VIEW (Mosaico por Cuadrantes) */}
      {viewMode === 'tiles' && (
        <div style={styles.tilesContainer}>
          {(['Leading', 'Improving', 'Weakening', 'Lagging'] as const).map((qName) => {
            const group = quadrantGroups[qName];
            const qStyle = quadrantBadgeStyle(qName);

            return (
              <div key={qName} style={{ ...styles.quadrantSection, borderColor: qStyle.borderColor as string }}>
                <div style={styles.quadrantSectionHeader}>
                  <span style={{ ...styles.quadrantBadge, ...qStyle, fontSize: '0.8125rem' }}>
                    {qName === 'Leading' && '🟢 Líderes (Leading)'}
                    {qName === 'Improving' && '🔵 Mejorando (Improving)'}
                    {qName === 'Weakening' && '🟡 Debilitándose (Weakening)'}
                    {qName === 'Lagging' && '🔴 Rezagados (Lagging)'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {group.length} {group.length === 1 ? 'activo' : 'activos'}
                  </span>
                </div>

                {group.length === 0 ? (
                  <div style={styles.emptyTile}>Sin activos en este cuadrante</div>
                ) : (
                  <div style={styles.tilesGrid}>
                    {group.map((r) => {
                      const pt = rrgPointMap.get(r.symbol);
                      const heat = getReturnHeatmapColor(r.returns_1m);
                      const isSelected = selectedAsset === r.symbol;
                      const isHovered = hoveredSymbol === r.symbol;

                      return (
                        <div
                          key={r.symbol}
                          onClick={() => onSelectAsset(r.symbol)}
                          onMouseEnter={() => onHoverSymbol(r.symbol)}
                          onMouseLeave={() => onHoverSymbol(null)}
                          style={{
                            ...styles.tileCard,
                            backgroundColor: heat.bg,
                            borderColor: isSelected || isHovered ? 'var(--accent)' : heat.border,
                            boxShadow: isSelected ? '0 0 0 2px var(--accent)' : undefined,
                            transform: isSelected || isHovered ? 'translateY(-2px)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
                              {r.symbol}
                            </span>
                            <span style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>
                              {pt?.headingArrow || '→'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Ret 1m:
                            </span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: heat.text, fontFamily: 'JetBrains Mono, monospace' }}>
                              {(r.returns_1m * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Rumbo:
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                              {pt?.heading !== undefined ? `${pt.heading}°` : '—'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              RS Score:
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                              {r.composite_rs.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
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
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0' },
  benchTag: {
    padding: '2px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent)',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  modeSwitcher: {
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    padding: 3,
    borderRadius: 6,
    border: '1px solid var(--border)',
    gap: 2,
  },
  modeBtn: {
    padding: '6px 12px',
    borderRadius: 4,
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  legendBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'var(--bg-primary)',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  legendLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  gradientBarWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  gradientBar: {
    width: 60,
    height: 8,
    borderRadius: 4,
    background: 'linear-gradient(to right, rgba(239, 68, 68, 0.8), rgba(239, 68, 68, 0.1))',
  },
  gradientBarPositive: {
    width: 60,
    height: 8,
    borderRadius: 4,
    background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.8))',
  },
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
  tr: { borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s ease' },
  td: { padding: '9px 8px', whiteSpace: 'nowrap', color: 'var(--text-primary)' },
  quadrantBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'inline-block',
  },
  tilesContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  quadrantSection: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: 14,
  },
  quadrantSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTile: {
    padding: 20,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontStyle: 'italic',
  },
  tilesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 10,
  },
  tileCard: {
    padding: 10,
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
