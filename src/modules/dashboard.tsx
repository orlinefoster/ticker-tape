import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useUIStore } from '@/store/uiStore';
import { calculatePositionSize, type PositionSizeResult } from '@/lib/vanTharp';

interface MarketSignal {
  symbol: string;
  name: string;
  source: string;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number; // 0 to 100
  timeframe: string;
  rationale: string;
  suggestedEntry: number;
  suggestedStop: number;
  suggestedTarget: number;
  targetPortfolio: 'iol' | 'binance';
}

const ACTIVE_SIGNALS: MarketSignal[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF (CEDEAR)',
    source: 'Top-Down Macro',
    direction: 'BUY',
    score: 86,
    timeframe: 'Daily / 1W',
    rationale: 'Régimen de expansión macro y momentum sectorial favorable.',
    suggestedEntry: 560.0,
    suggestedStop: 535.0,
    suggestedTarget: 610.0,
    targetPortfolio: 'iol',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin Spot (Binance)',
    source: 'Alpha Rotation Radar',
    direction: 'BUY',
    score: 91,
    timeframe: 'Daily',
    rationale: 'Rotación de capital hacia activos de reserva con quiebre de rango.',
    suggestedEntry: 67250.0,
    suggestedStop: 63500.0,
    suggestedTarget: 75000.0,
    targetPortfolio: 'binance',
  },
  {
    symbol: 'GGAL',
    name: 'Grupo Fin. Galicia (BYMA)',
    source: 'Intermarket Cycle',
    direction: 'BUY',
    score: 78,
    timeframe: 'Daily',
    rationale: 'Baja del riesgo país y volumen comprador en sector financiero local.',
    suggestedEntry: 4750.0,
    suggestedStop: 4420.0,
    suggestedTarget: 5410.0,
    targetPortfolio: 'iol',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc. (CEDEAR)',
    source: 'Topology Regimes',
    direction: 'NEUTRAL',
    score: 54,
    timeframe: 'Daily',
    rationale: 'Consolidación lateral en resistencia histórica.',
    suggestedEntry: 230.0,
    suggestedStop: 218.0,
    suggestedTarget: 254.0,
    targetPortfolio: 'iol',
  },
];

export function Dashboard() {
  const { setActiveRoute } = useUIStore();
  const {
    rates,
    cashHoldings,
    iolHoldings,
    binanceHoldings,
    equityHistory,
    alerts,
    dismissAlert,
    getCashValuationUsd,
    getIOLValuationUsd,
    getBinanceValuationUsd,
    getTotalNetWorthUsd,
    addTransaction,
    addIOLHolding,
    addBinanceHolding,
  } = usePortfolioStore();

  const cashUsd = getCashValuationUsd();
  const iolUsd = getIOLValuationUsd();
  const binanceUsd = getBinanceValuationUsd();
  const totalNetWorthUsd = getTotalNetWorthUsd();
  const totalNetWorthArs = totalNetWorthUsd * rates.ccl;

  const [equityTimeframe, setEquityTimeframe] = useState<'3M' | '6M' | 'YTD' | 'ALL'>('YTD');

  // Van Tharp Calculator Modal State
  const [selectedSignalForSizing, setSelectedSignalForSizing] = useState<MarketSignal | null>(null);
  const [riskPct, setRiskPct] = useState<number>(1.0); // 1% default 1R risk
  const [customEntry, setCustomEntry] = useState<number>(0);
  const [customStop, setCustomStop] = useState<number>(0);
  const [customTarget, setCustomTarget] = useState<number>(0);
  const [sizingSuccessMsg, setSizingSuccessMsg] = useState<string | null>(null);

  // Allocation percentages
  const pctCash = totalNetWorthUsd > 0 ? (cashUsd / totalNetWorthUsd) * 100 : 0;
  const pctIol = totalNetWorthUsd > 0 ? (iolUsd / totalNetWorthUsd) * 100 : 0;
  const pctBinance = totalNetWorthUsd > 0 ? (binanceUsd / totalNetWorthUsd) * 100 : 0;

  // Currency exposure
  const totalArsNominal =
    cashHoldings.filter((h) => h.currency === 'ARS').reduce((sum, h) => sum + h.amount, 0) +
    iolHoldings.filter((h) => h.currencyExposure === 'ARS').reduce((sum, h) => sum + h.nominalQuantity * h.currentPriceArs, 0);
  const pctArs = totalNetWorthUsd > 0 ? ((totalArsNominal / rates.ccl) / totalNetWorthUsd) * 100 : 0;
  const pctUsd = totalNetWorthUsd > 0 ? (100 - pctArs - pctBinance) : 0;

  // Simple SVG sparkline / equity curve calculator
  const minEquity = Math.min(...equityHistory.map((e) => e.totalUsd)) * 0.96;
  const maxEquity = Math.max(...equityHistory.map((e) => e.totalUsd)) * 1.04;
  const range = maxEquity - minEquity || 1;

  const svgWidth = 640;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 25;

  const points = equityHistory.map((pt, idx) => {
    const x = paddingX + (idx / (equityHistory.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((pt.totalUsd - minEquity) / range) * (svgHeight - paddingY * 2);
    return { x, y, pt };
  });

  const pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`;

  const handleOpenSizingModal = (sig: MarketSignal) => {
    setSelectedSignalForSizing(sig);
    setCustomEntry(sig.suggestedEntry);
    setCustomStop(sig.suggestedStop);
    setCustomTarget(sig.suggestedTarget);
    setSizingSuccessMsg(null);
  };

  const sizingResult: PositionSizeResult | null = selectedSignalForSizing
    ? calculatePositionSize({
        totalEquity: totalNetWorthUsd,
        riskPercentage: riskPct,
        entryPrice: customEntry,
        stopLossPrice: customStop,
        targetPrice: customTarget,
        assetType: selectedSignalForSizing.targetPortfolio === 'binance' ? 'CRIPTO' : 'CEDEAR',
      })
    : null;

  const handleExecuteSizedOrder = () => {
    if (!selectedSignalForSizing || !sizingResult || sizingResult.recommendedQuantity <= 0) return;

    if (selectedSignalForSizing.targetPortfolio === 'binance') {
      addBinanceHolding({
        symbol: selectedSignalForSizing.symbol,
        name: selectedSignalForSizing.name,
        amount: sizingResult.recommendedQuantity,
        avgBuyPriceUsdt: customEntry,
        currentPriceUsdt: customEntry,
      });
      addTransaction({
        portfolioType: 'binance',
        type: 'COMPRA',
        symbol: selectedSignalForSizing.symbol,
        quantity: sizingResult.recommendedQuantity,
        price: customEntry,
        currency: 'USDT',
        totalNominal: sizingResult.totalCapitalRequired,
        notes: `Orden Van Tharp (${riskPct}% R): Stop en $${customStop}, Target en $${customTarget} (${sizingResult.rMultipleTarget || 0}R)`,
      });
    } else {
      addIOLHolding({
        symbol: selectedSignalForSizing.symbol,
        name: selectedSignalForSizing.name,
        assetType: selectedSignalForSizing.symbol === 'GGAL' ? 'ACCION_LOCAL' : 'CEDEAR',
        nominalQuantity: sizingResult.recommendedQuantity,
        avgBuyPriceArs: customEntry,
        currentPriceArs: customEntry,
        currencyExposure: selectedSignalForSizing.symbol === 'GGAL' ? 'ARS' : 'USD_CCL',
      });
      addTransaction({
        portfolioType: 'iol',
        type: 'COMPRA',
        symbol: selectedSignalForSizing.symbol,
        quantity: sizingResult.recommendedQuantity,
        price: customEntry,
        currency: 'ARS',
        totalNominal: sizingResult.totalCapitalRequired,
        notes: `Orden Van Tharp (${riskPct}% R): Stop en $${customStop}, Target en $${customTarget} (${sizingResult.rMultipleTarget || 0}R)`,
      });
    }

    setSizingSuccessMsg(
      `✅ Posición de ${sizingResult.recommendedQuantity} ${selectedSignalForSizing.symbol} registrada con éxito respetando 1R = $${sizingResult.totalRiskAmount.toFixed(0)} USD.`
    );
    setTimeout(() => {
      setSelectedSignalForSizing(null);
      setSizingSuccessMsg(null);
    }, 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Top Institutional Ribbon (Net Worth & Capital Structure) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {/* Net Worth */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
            Patrimonio Neto Consolidado
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'monospace', lineHeight: 1.1 }}>
            ${totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>USD</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            ARS ${totalNetWorthArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })} <span style={{ color: 'var(--text-muted)' }}>(CCL ${rates.ccl})</span>
          </div>
        </div>

        {/* 1. Cash Portfolio Metric */}
        <div
          onClick={() => setActiveRoute('/portfolio')}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>💵 DINERO / CASH</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}>{pctCash.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace', marginTop: '2px' }}>
            ${cashUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>USD</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {cashHoldings.length} cuentas (Bancos, ARS/USD, Cauciones)
          </div>
        </div>

        {/* 2. IOL Portfolio Metric */}
        <div
          onClick={() => setActiveRoute('/portfolio')}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--signal-warning)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>🇦🇷 CARTERA IOL</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--signal-warning)', fontWeight: 700, fontFamily: 'monospace' }}>{pctIol.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace', marginTop: '2px' }}>
            ${iolUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>USD</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {iolHoldings.length} activos (BYMA, CEDEARs, Bonos)
          </div>
        </div>

        {/* 3. Binance Crypto Metric */}
        <div
          onClick={() => setActiveRoute('/portfolio')}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--signal-bullish)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>⚡ BINANCE CRIPTO</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--signal-bullish)', fontWeight: 700, fontFamily: 'monospace' }}>{pctBinance.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace', marginTop: '2px' }}>
            ${binanceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>USDT</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {binanceHoldings.length} monedas (BTC, ETH, SOL, Stable)
          </div>
        </div>
      </div>

      {/* ── Main 16:9 Grid (60% Analysis & Evolution / 40% Action Desk & Signals) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
        {/* Left Column (60%): Equity Curve & Portfolios Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Chart Container */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                  📈 EVOLUCIÓN PATRIMONIAL CONSOLIDADA
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Crecimiento del capital acumulado de las 3 carteras en dólares
                </div>
              </div>

              {/* Timeframe Buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['3M', '6M', 'YTD', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setEquityTimeframe(tf)}
                    style={{
                      padding: '3px 8px',
                      backgroundColor: equityTimeframe === tf ? 'var(--accent)' : 'var(--bg-surface-card)',
                      color: equityTimeframe === tf ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Interactive Chart */}
            <div style={{ width: '100%', height: '190px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="var(--border)" />

                {/* Area & Line */}
                <path d={areaD} fill="url(#equityGrad)" />
                <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" />

                {/* Points */}
                {points.map((p) => (
                  <g key={p.pt.date}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill="var(--bg-canvas)" stroke="var(--accent)" strokeWidth="2" />
                    <text x={p.x} y={svgHeight - 8} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">
                      {p.pt.date.slice(5)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Sub-bar with allocations & currency risk */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-surface-card)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                color: 'var(--text-secondary)',
              }}
            >
              <span>
                Distribución: <strong style={{ color: 'var(--accent)' }}>Cash {pctCash.toFixed(0)}%</strong> |{' '}
                <strong style={{ color: 'var(--signal-warning)' }}>IOL {pctIol.toFixed(0)}%</strong> |{' '}
                <strong style={{ color: 'var(--signal-bullish)' }}>Cripto {pctBinance.toFixed(0)}%</strong>
              </span>
              <span>
                Riesgo Cambiario:{' '}
                <strong style={{ color: 'var(--text-bright)' }}>USD/USDT {(pctUsd + pctBinance).toFixed(0)}%</strong> |{' '}
                <strong style={{ color: 'var(--signal-warning)' }}>ARS {pctArs.toFixed(0)}%</strong>
              </span>
            </div>
          </div>

          {/* Holdings Snapshot Table (High density) */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                💼 ACTIVOS PRINCIPALES CONSOLIDADOS
              </div>
              <button
                onClick={() => setActiveRoute('/portfolio')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Ver todos ({cashHoldings.length + iolHoldings.length + binanceHoldings.length}) →
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>ACTIVO</th>
                  <th style={{ padding: '6px' }}>CARTERA</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>CANTIDAD</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>VALUACIÓN USD</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>PNL %</th>
                </tr>
              </thead>
              <tbody>
                {/* Binance items */}
                {binanceHoldings.slice(0, 3).map((b) => {
                  const val = b.amount * b.currentPriceUsdt;
                  const pnl = ((b.currentPriceUsdt - b.avgBuyPriceUsdt) / b.avgBuyPriceUsdt) * 100;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px', color: 'var(--text-bright)', fontWeight: 700 }}>{b.symbol}</td>
                      <td style={{ padding: '6px', color: 'var(--signal-bullish)' }}>Binance Spot</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{b.amount}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: pnl >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}

                {/* IOL items */}
                {iolHoldings.slice(0, 3).map((i) => {
                  const valUsd = (i.nominalQuantity * i.currentPriceArs) / rates.ccl;
                  const pnl = ((i.currentPriceArs - i.avgBuyPriceArs) / i.avgBuyPriceArs) * 100;
                  return (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px', color: 'var(--text-bright)', fontWeight: 700 }}>{i.symbol}</td>
                      <td style={{ padding: '6px', color: 'var(--signal-warning)' }}>IOL ({i.assetType})</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{i.nominalQuantity.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>${valUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: pnl >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}

                {/* Cash item */}
                {cashHoldings.slice(0, 2).map((c) => {
                  const valUsd = c.currency === 'USD' ? c.amount : c.amount / rates.ccl;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px', color: 'var(--text-bright)', fontWeight: 700 }}>{c.currency} Líquido</td>
                      <td style={{ padding: '6px', color: 'var(--accent)' }}>Cash ({c.institution})</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{c.amount.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>${valUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {c.yieldRateAnnual ? `${c.yieldRateAnnual}% TNA` : '0%'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (40%): Action Desk & Active Market Signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action & Notification Desk */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                🔔 BANDEJA DE ACCIONES & CONCILIACIÓN
              </div>
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '2px', backgroundColor: 'var(--signal-warning-muted)', color: 'var(--signal-warning)', fontWeight: 700 }}>
                {alerts.length} pendientes
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ✅ Todas las carteras y conciliaciones están al día.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts.map((alt) => (
                  <div
                    key={alt.id}
                    style={{
                      padding: '10px',
                      backgroundColor: 'var(--bg-surface-card)',
                      borderLeft: `3px solid ${alt.severity === 'warning' ? 'var(--signal-warning)' : 'var(--accent)'}`,
                      borderTop: '1px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)' }}>{alt.title}</span>
                      <button
                        onClick={() => dismissAlert(alt.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                        title="Descartar alerta"
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{alt.detail}</div>
                    {alt.actionRoute && (
                      <button
                        onClick={() => setActiveRoute(alt.actionRoute!)}
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: '4px',
                          padding: '2px 8px',
                          backgroundColor: 'var(--bg-canvas)',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                        }}
                      >
                        {alt.actionLabel || 'Resolver'} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tactical Signals Radar with Van Tharp Integration */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                  🎯 RADAR DE SEÑALES ACTIVAS
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Generadas por Top-Down, Intermarket y Topology
                </div>
              </div>
              <button
                onClick={() => setActiveRoute('/top-down')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Abrir Engine →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ACTIVE_SIGNALS.map((sig) => (
                <div
                  key={sig.symbol}
                  style={{
                    padding: '10px',
                    backgroundColor: 'var(--bg-surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-bright)', fontFamily: 'monospace' }}>{sig.symbol}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sig.name}</span>
                    </div>

                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '2px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        backgroundColor:
                          sig.direction === 'BUY'
                            ? 'var(--signal-bullish-muted)'
                            : sig.direction === 'SELL'
                            ? 'var(--signal-bearish-muted)'
                            : 'var(--bg-canvas)',
                        color:
                          sig.direction === 'BUY'
                            ? 'var(--signal-bullish)'
                            : sig.direction === 'SELL'
                            ? 'var(--signal-bearish)'
                            : 'var(--signal-neutral)',
                      }}
                    >
                      {sig.direction} ({sig.score}/100)
                    </span>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{sig.source}:</span> {sig.rationale}
                  </div>

                  {/* Action Bar: Van Tharp Sizing Button + Chart Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Entry: ${sig.suggestedEntry} | Stop: ${sig.suggestedStop}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleOpenSizingModal(sig)}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: 'var(--accent)',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                        }}
                      >
                        📐 Position Size (Van Tharp)
                      </button>
                      <button
                        onClick={() => setActiveRoute('/chart')}
                        style={{
                          padding: '3px 6px',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.65rem',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                        }}
                      >
                        Gráfico 📉
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Van Tharp Position Sizing Drawer / Modal ── */}
      {selectedSignalForSizing && sizingResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              fontFamily: 'monospace',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-bright)' }}>
                  📐 Calculadora de Position Sizing (Van Tharp)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {selectedSignalForSizing.symbol} - {selectedSignalForSizing.name} ({selectedSignalForSizing.targetPortfolio.toUpperCase()})
                </span>
              </div>
              <button
                onClick={() => setSelectedSignalForSizing(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {sizingSuccessMsg ? (
              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--signal-bullish)', borderRadius: 'var(--radius-sm)', color: 'var(--signal-bullish)', fontSize: '0.85rem' }}>
                {sizingSuccessMsg}
              </div>
            ) : (
              <>
                {/* Inputs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.75rem' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)' }}>Capital de Cuenta (Equity Total):</label>
                    <input
                      type="text"
                      disabled
                      value={`$${totalNetWorthUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`}
                      style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-surface-card)', border: '1px solid var(--border)', color: 'var(--text-bright)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)' }}>Riesgo Máximo (1R en %):</label>
                    <select
                      value={riskPct}
                      onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                      style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--text-bright)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                    >
                      <option value="0.5">0.5% ($R = ${(totalNetWorthUsd * 0.005).toFixed(0)} USD)</option>
                      <option value="1.0">1.0% ($R = ${(totalNetWorthUsd * 0.01).toFixed(0)} USD)</option>
                      <option value="1.5">1.5% ($R = ${(totalNetWorthUsd * 0.015).toFixed(0)} USD)</option>
                      <option value="2.0">2.0% ($R = ${(totalNetWorthUsd * 0.02).toFixed(0)} USD)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)' }}>Precio de Entrada ($):</label>
                    <input
                      type="number"
                      step="any"
                      value={customEntry}
                      onChange={(e) => setCustomEntry(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--text-bright)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)' }}>Stop Loss Hard ($):</label>
                    <input
                      type="number"
                      step="any"
                      value={customStop}
                      onChange={(e) => setCustomStop(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--signal-bearish)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ color: 'var(--text-muted)' }}>Target Profit Objetivo ($):</label>
                    <input
                      type="number"
                      step="any"
                      value={customTarget}
                      onChange={(e) => setCustomTarget(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--signal-bullish)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                    />
                  </div>
                </div>

                {/* Sizing Calculation Results Box */}
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--bg-surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Presupuesto de Riesgo (1R):</span>
                    <strong style={{ color: 'var(--signal-bearish)' }}>${sizingResult.totalRiskAmount.toFixed(2)} USD</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Riesgo por Unidad (Entry - Stop):</span>
                    <strong>${sizingResult.riskPerShare.toFixed(2)} ({sizingResult.riskPerSharePct.toFixed(1)}%)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                    <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>Cantidad Recomendada a Comprar:</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--signal-bullish)' }}>
                      {sizingResult.recommendedQuantity} {selectedSignalForSizing.symbol}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Capital Requerido para la Orden:</span>
                    <strong>${sizingResult.totalCapitalRequired.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({sizingResult.portfolioAllocationPct.toFixed(1)}% cartera)</strong>
                  </div>

                  {sizingResult.rMultipleTarget && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)' }}>
                      <span>Ratio Beneficio/Riesgo Objetivo:</span>
                      <strong>{sizingResult.rMultipleTarget}R (Target)</strong>
                    </div>
                  )}

                  {sizingResult.warningMessage && (
                    <div style={{ marginTop: '6px', padding: '6px', backgroundColor: 'var(--signal-warning-muted)', color: 'var(--signal-warning)', fontSize: '0.7rem', borderRadius: '3px' }}>
                      {sizingResult.warningMessage}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    onClick={() => setSelectedSignalForSizing(null)}
                    style={{ padding: '8px 14px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleExecuteSizedOrder}
                    disabled={sizingResult.recommendedQuantity <= 0 || sizingResult.isOverallocated}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: sizingResult.isOverallocated ? 'var(--text-muted)' : 'var(--signal-bullish)',
                      color: '#000000',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      cursor: sizingResult.isOverallocated ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ⚡ Registrar Orden en Cartera {selectedSignalForSizing.targetPortfolio.toUpperCase()}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
