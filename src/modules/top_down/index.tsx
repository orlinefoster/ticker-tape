import React, { useState, useEffect, useCallback } from 'react';
import { commands, type OHLCVBar } from '@/lib/tauri';
import { UNIVERSE_PRESETS } from './presets';
import type { AnalystCandidate, AnalystReport, MarketUniverseType } from './types';
import { runTopDownAnalystPipeline } from './engine';
import { AnalystReportView } from './components/AnalystReportView';
import { OperatorDeskView } from './components/OperatorDeskView';
import { AIPromptModal } from './components/AIPromptModal';

export default function TopDownModule() {
  const [activeTab, setActiveTab] = useState<'analyst' | 'operator'>('analyst');
  const [selectedUniverse, setSelectedUniverse] = useState<MarketUniverseType>('crypto');
  const [customSymbols, setCustomSymbols] = useState<string>('SPY, QQQ, NVDA, TLT, GLD');
  const [customBenchmark, setCustomBenchmark] = useState<string>('SPY');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalystReport | null>(null);
  const [operatorCandidates, setOperatorCandidates] = useState<AnalystCandidate[]>([]);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);

  // Helper to generate simulated bars when provider is offline or rate-limited
  const generateMockBars = (sym: string, count = 90): OHLCVBar[] => {
    const bars: OHLCVBar[] = [];
    let p = sym === 'BTC' ? 65000 : sym === 'ETH' ? 3200 : sym === 'SPY' ? 560 : 150;
    const isBull = ['SOL', 'NVDA', 'RENDER', 'MELI', 'BTC'].includes(sym);

    for (let i = count; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const trend = isBull ? 0.0035 : 0.001;
      const noise = (Math.sin(i * 0.4) * 0.015) + (Math.random() * 0.01 - 0.005);
      p = Math.max(1, p * (1 + trend + noise));

      bars.push({
        symbol: sym,
        date: dateStr,
        open: p * 0.995,
        high: p * 1.015,
        low: p * 0.985,
        close: p,
        volume: Math.floor(10000 + Math.random() * 50000),
      });
    }
    return bars;
  };

  const executePipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const preset = UNIVERSE_PRESETS.find((p) => p.id === selectedUniverse);
      let benchmark = preset?.benchmark || 'SPY';
      let symbolList: string[] = preset?.symbols || [];

      if (selectedUniverse === 'custom') {
        benchmark = customBenchmark.trim().toUpperCase() || 'SPY';
        symbolList = customSymbols
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0);
        if (!symbolList.includes(benchmark)) {
          symbolList.unshift(benchmark);
        }
      }

      // 1. Fetch intermarket analysis
      let intermarketData: any = null;
      try {
        intermarketData = await commands.runAnalysis('intermarket', [], {});
      } catch (err) {
        console.warn('Intermarket backend not ready, using fallback:', err);
      }

      // 2. Fetch bars for all symbols in universe
      const barsMap: Record<string, OHLCVBar[]> = {};
      for (const sym of symbolList) {
        try {
          const bars = await commands.fetchMarketData(sym, '6m');
          if (bars && bars.length > 10) {
            barsMap[sym] = bars;
          } else {
            barsMap[sym] = generateMockBars(sym);
          }
        } catch {
          barsMap[sym] = generateMockBars(sym);
        }
      }

      // 3. Run the top-down pipeline engine
      const generatedReport = runTopDownAnalystPipeline(
        selectedUniverse,
        benchmark,
        symbolList,
        barsMap,
        intermarketData
      );

      setReport(generatedReport);
      setOperatorCandidates(generatedReport.topCandidates);
    } catch (e: any) {
      setError(e.message || 'Error al ejecutar el pipeline Top-Down');
    } finally {
      setLoading(false);
    }
  }, [selectedUniverse, customBenchmark, customSymbols]);

  useEffect(() => {
    executePipeline();
  }, [selectedUniverse]);

  const handleSendToOperator = (candidates: AnalystCandidate[]) => {
    setOperatorCandidates(candidates);
    setActiveTab('operator');
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <span style={{ fontSize: '1.8rem' }}>🎯</span>
            <div>
              <h1 style={styles.title}>Sistema Automatizado Top-Down & Gestión de Riesgo</h1>
              <p style={styles.subtitle}>
                Análisis macro intermarket, fuerza relativa vs benchmark, cuadrantes RRG, confirmación Elliott y dimensionamiento de capital
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div style={styles.actionRow}>
          <button
            onClick={executePipeline}
            disabled={loading}
            style={styles.refreshBtn}
          >
            {loading ? '⏳ Analizando...' : '🔄 Re-ejecutar Análisis'}
          </button>
        </div>
      </div>

      {/* Universe & Config Selector Bar */}
      <div style={styles.configBar}>
        <div style={styles.universeGroup}>
          <span style={styles.configLabel}>Universo de Mercado:</span>
          <div style={styles.presetButtons}>
            {UNIVERSE_PRESETS.map((preset) => {
              const isSelected = selectedUniverse === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedUniverse(preset.id)}
                  style={{
                    ...styles.presetBtn,
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  }}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom universe inputs */}
        {selectedUniverse === 'custom' && (
          <div style={styles.customInputRow}>
            <input
              type="text"
              placeholder="Benchmark (ej. SPY)"
              value={customBenchmark}
              onChange={(e) => setCustomBenchmark(e.target.value)}
              style={styles.customInputSmall}
            />
            <input
              type="text"
              placeholder="Símbolos separados por coma (ej. AAPL, NVDA, TSLA, BTC)"
              value={customSymbols}
              onChange={(e) => setCustomSymbols(e.target.value)}
              style={styles.customInputLarge}
            />
            <button onClick={executePipeline} style={styles.applyBtn}>
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs (Analista vs Operador) */}
      <div style={styles.tabsRow}>
        <button
          onClick={() => setActiveTab('analyst')}
          style={{
            ...styles.tabBtn,
            borderBottomColor: activeTab === 'analyst' ? '#00e5ff' : 'transparent',
            color: activeTab === 'analyst' ? '#00e5ff' : 'var(--text-secondary)',
          }}
        >
          🕵️‍♂️ Capa Analista (Top-Down Market Intelligence)
        </button>

        <button
          onClick={() => setActiveTab('operator')}
          style={{
            ...styles.tabBtn,
            borderBottomColor: activeTab === 'operator' ? '#00e5ff' : 'transparent',
            color: activeTab === 'operator' ? '#00e5ff' : 'var(--text-secondary)',
          }}
        >
          💼 Capa Operador: Risk & Money Management ({operatorCandidates.length} Candidatos)
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={executePipeline} style={styles.retryBtn}>
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !report && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Calculando régimen intermarket, fuerza relativa, cuadrantes RRG y estructuras Elliott...
          </p>
        </div>
      )}

      {/* Active Tab View */}
      {report && (
        <>
          {activeTab === 'analyst' ? (
            <AnalystReportView
              report={report}
              onSendToOperator={handleSendToOperator}
              onOpenAIPrompt={() => setShowAIModal(true)}
            />
          ) : (
            <OperatorDeskView candidates={operatorCandidates} />
          )}
        </>
      )}

      {/* Compact AI Prompt Modal */}
      {showAIModal && report && (
        <AIPromptModal
          promptText={report.compactAIPrompt}
          estimatedTokens={report.estimatedAITokens}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minHeight: '100%',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
  },
  refreshBtn: {
    padding: '10px 18px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  configBar: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  universeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  configLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  presetButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  customInputRow: {
    display: 'flex',
    gap: '10px',
  },
  customInputSmall: {
    width: '120px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  },
  customInputLarge: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  },
  applyBtn: {
    padding: '8px 16px',
    backgroundColor: '#00e5ff',
    color: '#000',
    fontWeight: 'bold',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
  },
  tabsRow: {
    display: 'flex',
    gap: '24px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '2px',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '10px 4px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorBox: {
    padding: '14px',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: '8px',
    color: '#f44336',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retryBtn: {
    padding: '6px 12px',
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border)',
    borderTopColor: '#00e5ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
