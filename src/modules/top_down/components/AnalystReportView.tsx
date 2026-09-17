import React, { useState } from 'react';
import type { AnalystCandidate, AnalystReport } from '../types';
import { RRGQuadrantChart, type RRGDataPoint } from '@/components/RRGQuadrantChart';

interface AnalystReportViewProps {
  report: AnalystReport;
  onSendToOperator: (candidates: AnalystCandidate[]) => void;
  onOpenAIPrompt: () => void;
}

export function AnalystReportView({
  report,
  onSendToOperator,
  onOpenAIPrompt,
}: AnalystReportViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    report.topCandidates[0]?.symbol || report.items[0]?.symbol || ''
  );
  const [quadrantFilter, setQuadrantFilter] = useState<string>('ALL');

  // Convert RRG points for the RRGQuadrantChart component
  const rrgPoints: RRGDataPoint[] = report.items.map((item) => ({
    symbol: item.symbol,
    x: item.rrg.rsRatio - 100,
    y: item.rrg.rsMomentum - 100,
    history: item.rrg.history,
  }));

  const filteredItems = report.items.filter((item) => {
    if (quadrantFilter === 'ALL') return true;
    return item.rrg.quadrant === quadrantFilter;
  });

  const getQuadrantBadge = (quadrant: string) => {
    switch (quadrant) {
      case 'Leading':
        return { bg: 'rgba(76, 175, 80, 0.15)', color: '#4caf50', label: '🟢 Leading' };
      case 'Weakening':
        return { bg: 'rgba(255, 152, 0, 0.15)', color: '#ff9800', label: '🟡 Weakening' };
      case 'Lagging':
        return { bg: 'rgba(244, 67, 54, 0.15)', color: '#f44336', label: '🔴 Lagging' };
      case 'Improving':
        return { bg: 'rgba(33, 150, 243, 0.15)', color: '#2196f3', label: '🔵 Improving' };
      default:
        return { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', label: quadrant };
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Macro & Intermarket Context Header */}
      <div style={styles.macroBanner}>
        <div style={styles.macroLeft}>
          <div style={styles.regimePill}>
            <span style={{ fontSize: '1.2rem' }}>
              {report.intermarket.regime === 'Risk-On' ? '🚀' : report.intermarket.regime === 'Risk-Off' ? '🛡️' : '⚖️'}
            </span>
            <div>
              <div style={styles.regimeTitle}>Régimen: {report.intermarket.regime}</div>
              <div style={styles.regimeSubtitle}>Fase del Ciclo: {report.intermarket.cyclePhase} (Confianza: {(report.intermarket.confidence * 100).toFixed(0)}%)</div>
            </div>
          </div>
          <p style={styles.macroSummary}>{report.intermarket.summaryText}</p>
        </div>

        <div style={styles.macroStatsGrid}>
          <div style={styles.macroStatBox}>
            <div style={styles.macroStatLabel}>Dólar (DXY)</div>
            <div style={{ ...styles.macroStatVal, color: report.intermarket.dollarTrend === 'Bullish' ? '#4caf50' : '#ff9800' }}>
              {report.intermarket.dollarTrend}
            </div>
          </div>
          <div style={styles.macroStatBox}>
            <div style={styles.macroStatLabel}>Bonos / Yields</div>
            <div style={styles.macroStatVal}>{report.intermarket.bondsTrend}</div>
          </div>
          <div style={styles.macroStatBox}>
            <div style={styles.macroStatLabel}>Stocks/Bonds Ratio</div>
            <div style={{ ...styles.macroStatVal, color: '#4caf50' }}>{report.intermarket.stocksBondsRatioTrend}</div>
          </div>
          <div style={styles.macroStatBox}>
            <div style={styles.macroStatLabel}>Benchmark</div>
            <div style={{ ...styles.macroStatVal, color: '#00e5ff', fontWeight: 'bold' }}>{report.benchmark}</div>
          </div>
        </div>
      </div>

      {/* 2. Top Actionable Candidates (Cards) */}
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>🎯 Candidatos Filtrados (Top-Down Alpha)</h3>
          <p style={styles.sectionSubtitle}>
            Activos con fuerza relativa destacada, rotación favorable y confirmación de estructura Elliott
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onOpenAIPrompt} style={styles.aiButton}>
            🤖 Prompt IA Compacto ({report.estimatedAITokens} tok)
          </button>
          <button onClick={() => onSendToOperator(report.topCandidates)} style={styles.primaryButton}>
            💼 Cargar a Capa Operador ({report.topCandidates.length})
          </button>
        </div>
      </div>

      <div style={styles.candidatesGrid}>
        {report.topCandidates.map((cand) => {
          const badge = getQuadrantBadge(cand.quadrant);
          const isSel = selectedSymbol === cand.symbol;
          return (
            <div
              key={cand.symbol}
              onClick={() => setSelectedSymbol(cand.symbol)}
              style={{
                ...styles.candidateCard,
                borderColor: isSel ? '#00e5ff' : 'var(--border)',
                backgroundColor: isSel ? 'rgba(0, 229, 255, 0.04)' : 'var(--bg-surface)',
              }}
            >
              <div style={styles.candidateTop}>
                <div>
                  <span style={styles.candidateSymbol}>{cand.symbol}</span>
                  <span style={styles.candidatePrice}>${cand.price.toLocaleString()}</span>
                </div>
                <span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              </div>

              <div style={styles.candidateCategory}>
                {cand.category === 'OUTPERFORMER' ? '⚡ Líder en Expansión' : '🔄 Oportunidad Reversión a la Media'}
              </div>

              <div style={styles.candidateElliottBox}>
                <div style={styles.candidateWave}>{cand.elliott.currentWave}</div>
                <div style={styles.candidateRationale}>{cand.elliott.rationale}</div>
              </div>

              <div style={styles.candidateLevels}>
                <div>
                  <span style={styles.levelLabel}>Invalidación / Stop: </span>
                  <span style={styles.stopLevel}>${cand.elliott.invalidationPrice}</span>
                </div>
                <div>
                  <span style={styles.levelLabel}>Objetivo: </span>
                  <span style={styles.targetLevel}>${cand.elliott.targetPrice}</span>
                </div>
              </div>

              <div style={styles.candidateFooter}>
                <span>Alpha 3M: <strong style={{ color: cand.alpha3m >= 0 ? '#4caf50' : '#f44336' }}>+{cand.alpha3m}%</strong></span>
                <span>Score: <strong>{cand.score}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Interactive RRG Chart & Quadrant Matrix */}
      <div style={styles.chartAndTableSplit}>
        <div style={styles.rrgContainer}>
          <RRGQuadrantChart
            points={rrgPoints}
            benchmarkSymbol={report.benchmark}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          />
        </div>

        {/* 4. Relative Performance Ranking Table */}
        <div style={styles.tableContainer}>
          <div style={styles.tableToolbar}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Ranking de Fuerza Relativa vs {report.benchmark}
            </h4>
            <div style={styles.filterPills}>
              {['ALL', 'Leading', 'Improving', 'Weakening', 'Lagging'].map((f) => (
                <button
                  key={f}
                  onClick={() => setQuadrantFilter(f)}
                  style={{
                    ...styles.filterBtn,
                    backgroundColor: quadrantFilter === f ? 'var(--primary)' : 'var(--bg-tertiary)',
                    color: quadrantFilter === f ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Activo</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Cuadrante</th>
                  <th style={styles.th}>Ret. 1M</th>
                  <th style={styles.th}>Ret. 3M</th>
                  <th style={styles.th}>Alpha 3M</th>
                  <th style={styles.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const badge = getQuadrantBadge(item.rrg.quadrant);
                  const isSel = selectedSymbol === item.symbol;
                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item.symbol)}
                      style={{
                        ...styles.tr,
                        backgroundColor: isSel ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {item.symbol}
                      </td>
                      <td style={styles.td}>${item.currentPrice.toLocaleString()}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color, fontSize: '0.75rem' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: item.returns1m >= 0 ? '#4caf50' : '#f44336' }}>
                        {item.returns1m > 0 ? `+${item.returns1m}%` : `${item.returns1m}%`}
                      </td>
                      <td style={{ ...styles.td, color: item.returns3m >= 0 ? '#4caf50' : '#f44336' }}>
                        {item.returns3m > 0 ? `+${item.returns3m}%` : `${item.returns3m}%`}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: item.alpha3m >= 0 ? '#4caf50' : '#f44336' }}>
                        {item.alpha3m > 0 ? `+${item.alpha3m}%` : `${item.alpha3m}%`}
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>{item.compositeScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  macroBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    gap: '20px',
    flexWrap: 'wrap',
  },
  macroLeft: {
    flex: 1,
    minWidth: '280px',
  },
  regimePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  regimeTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  regimeSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  macroSummary: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  macroStatsGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  macroStatBox: {
    padding: '8px 14px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    minWidth: '110px',
  },
  macroStatLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    marginBottom: '4px',
  },
  macroStatVal: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
  },
  sectionSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  primaryButton: {
    padding: '10px 18px',
    backgroundColor: '#00e5ff',
    color: '#000',
    fontWeight: 'bold',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  aiButton: {
    padding: '10px 18px',
    backgroundColor: 'rgba(179, 136, 255, 0.15)',
    color: '#b388ff',
    fontWeight: 'bold',
    borderRadius: '8px',
    border: '1px solid rgba(179, 136, 255, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  candidatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  candidateCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'all 0.2s ease',
  },
  candidateTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  candidateSymbol: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginRight: '8px',
  },
  candidatePrice: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  candidateCategory: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#00e5ff',
  },
  candidateElliottBox: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
  },
  candidateWave: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  candidateRationale: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  },
  candidateLevels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    padding: '4px 0',
  },
  levelLabel: {
    color: 'var(--text-tertiary)',
  },
  stopLevel: {
    color: '#f44336',
    fontWeight: '600',
  },
  targetLevel: {
    color: '#4caf50',
    fontWeight: '600',
  },
  candidateFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '8px',
    color: 'var(--text-secondary)',
  },
  chartAndTableSplit: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  rrgContainer: {
    minHeight: '450px',
  },
  tableContainer: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tableToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  filterPills: {
    display: 'flex',
    gap: '6px',
  },
  filterBtn: {
    padding: '4px 10px',
    fontSize: '0.75rem',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
  },
  tableScroll: {
    overflowX: 'auto',
    maxHeight: '400px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.85rem',
  },
  th: {
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid var(--border-subtle)',
  },
};
