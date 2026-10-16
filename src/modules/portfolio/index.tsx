import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePortfolioCalculator } from '@/lib/usePortfolioCalculator';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { useUIStore } from '@/store/uiStore';
import { PortfolioTabs, type PortfolioTabId } from './components/PortfolioTabs';
import { ConsolidatedTab } from './components/ConsolidatedTab';
import { CashDeskTab } from './components/CashDeskTab';
import { IOLHoldingsTab } from './components/IOLHoldingsTab';
import { BinanceHoldingsTab } from './components/BinanceHoldingsTab';
import { LedgerHistoryTab } from './components/LedgerHistoryTab';

export default function PortfolioModule() {
  const [activeTab, setActiveTab] = useState<PortfolioTabId>('consolidated');
  const { override } = useServiceStatusStore();
  const setActiveRoute = useUIStore((state) => state.setActiveRoute);

  const {
    rates,
    setRates,
    cashHoldings,
    iolHoldings,
    binanceHoldings,
    transactions,
    addCashHolding,
    removeCashHolding,
    addIOLHolding,
    removeIOLHolding,
    addBinanceHolding,
    removeBinanceHolding,
    addTransaction,
  } = usePortfolioStore();

  const metrics = usePortfolioCalculator();
  const isReal = override === 'Real';

  // In Mock mode or Auto/Real, effective holdings come from the unified store.
  // Real mode displays real holdings stored in usePortfolioStore (never wiped to empty!).
  const effectiveCashHoldings = cashHoldings;
  const effectiveIolHoldings = iolHoldings;
  const effectiveBinanceHoldings = binanceHoldings;
  const effectiveTransactions = transactions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Module Title & Global Net Worth Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>
            💼 Terminal de Carteras &amp; Patrimonio Multi-Activo
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Consolidación unificada de Liquidez (Cash/USDT), InvertirOnline (BYMA) y Binance Spot
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              PATRIMONIO NETO TOTAL
            </div>
            <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              ${metrics.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>USD</span>
            </div>
          </div>

          <div
            className="font-mono"
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            CCL: ${rates.ccl}
          </div>
        </div>
      </div>

      {/* Real Mode Warning Banner */}
      {isReal && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>🔒</span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--signal-bearish)' }}>
                MODO REAL ACTIVO: CARTERAS SIMULADAS AISLADAS ($0.00 USD)
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Las posiciones simuladas no se reflejan para evitar distorsiones con capital real. Vincula tus credenciales en Proveedores para importar balances auténticos.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveRoute('/providers')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'var(--bg-surface-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-bright)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⚡ Conectar Binance API
            </button>
            <button
              onClick={() => setActiveRoute('/providers')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(76, 201, 240, 0.15)',
                border: '1px solid rgba(76, 201, 240, 0.4)',
                borderRadius: 'var(--radius-sm)',
                color: '#4CC9F0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🇦🇷 Vincular IOL MCP
            </button>
          </div>
        </div>
      )}

      {/* Accessible Navigation Tabs */}
      <PortfolioTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cashCount={effectiveCashHoldings.length}
        iolCount={effectiveIolHoldings.length}
        binanceCount={effectiveBinanceHoldings.length}
        transactionsCount={effectiveTransactions.length}
      />

      {/* Tab Panels */}
      {activeTab === 'consolidated' && (
        <ConsolidatedTab metrics={metrics} cclRate={rates.ccl} />
      )}

      {activeTab === 'cash' && (
        <CashDeskTab
          cashHoldings={effectiveCashHoldings}
          rates={rates}
          onUpdateRates={setRates}
          onAddCashHolding={addCashHolding}
          onRemoveCashHolding={removeCashHolding}
          onAddTransaction={addTransaction}
        />
      )}

      {activeTab === 'iol' && (
        <IOLHoldingsTab
          iolHoldings={effectiveIolHoldings}
          cclRate={rates.ccl}
          onAddIOLHolding={addIOLHolding}
          onRemoveIOLHolding={removeIOLHolding}
          onAddTransaction={addTransaction}
        />
      )}

      {activeTab === 'binance' && (
        <BinanceHoldingsTab
          binanceHoldings={effectiveBinanceHoldings}
          onAddBinanceHolding={addBinanceHolding}
          onRemoveBinanceHolding={removeBinanceHolding}
          onAddTransaction={addTransaction}
        />
      )}

      {activeTab === 'history' && (
        <LedgerHistoryTab transactions={effectiveTransactions} />
      )}
    </div>
  );
}
