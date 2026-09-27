import React from 'react';

export type PortfolioTabId = 'consolidated' | 'cash' | 'iol' | 'binance' | 'history';

interface PortfolioTabsProps {
  activeTab: PortfolioTabId;
  onTabChange: (tab: PortfolioTabId) => void;
  cashCount: number;
  iolCount: number;
  binanceCount: number;
  transactionsCount: number;
}

export const PortfolioTabs: React.FC<PortfolioTabsProps> = ({
  activeTab,
  onTabChange,
  cashCount,
  iolCount,
  binanceCount,
  transactionsCount,
}) => {
  const tabs: { id: PortfolioTabId; label: string; icon: string; count?: number }[] = [
    { id: 'consolidated', label: 'Patrimonio Consolidado', icon: '🌐' },
    { id: 'cash', label: 'Cash & Liquidez', icon: '💵', count: cashCount },
    { id: 'iol', label: 'BYMA / CEDEARs (IOL)', icon: '🇦🇷', count: iolCount },
    { id: 'binance', label: 'Crypto Spot (Binance)', icon: '⚡', count: binanceCount },
    { id: 'history', label: 'Libro Contable', icon: '📖', count: transactionsCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Pestañas de Carteras y Patrimonio"
      style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '8px',
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              backgroundColor: isActive ? 'var(--bg-surface-card)' : 'transparent',
              color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="font-mono"
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: isActive ? 'var(--accent-muted)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
