import React, { useState } from 'react';
import { Card, Button, Badge, StatMetric } from '@/components/ui';
import { DonutChart, type PieSegment } from '@/components/DonutChart';
import { commands } from '@/lib/tauri';
import { useUIStore } from '@/store/uiStore';
import { useServiceStatusStore } from '@/store/serviceStatusStore';
import { EquityCurveChart } from './components/EquityCurveChart';
import { ExoPositionManagerModal } from './components/ExoPositionManagerModal';
import { RiskReturnMetricsCard } from './components/RiskReturnMetricsCard';

interface CryptoPosition {
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  allocationPct: number;
  network: string;
}

interface TradeRecord {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  symbol: string;
  amount?: number;
  price?: number;
  totalUsdt: number;
  feeUsdt?: number;
  realizedPnL?: number;
}

interface EquityPoint {
  date: string;
  equity: number;
  benchmark: number;
  drawdown: number;
}

const INITIAL_CRYPTO_POSITIONS: CryptoPosition[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin Spot',
    amount: 0.45,
    avgBuyPrice: 61500.0,
    currentPrice: 67250.0,
    marketValue: 30262.5,
    unrealizedPnL: 2587.5,
    unrealizedPnLPct: 9.35,
    allocationPct: 0.528,
    network: 'Bitcoin Core',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum Spot',
    amount: 3.8,
    avgBuyPrice: 2850.0,
    currentPrice: 3120.0,
    marketValue: 11856.0,
    unrealizedPnL: 1026.0,
    unrealizedPnLPct: 9.47,
    allocationPct: 0.207,
    network: 'Ethereum Mainnet',
  },
  {
    symbol: 'SOL',
    name: 'Solana Spot',
    amount: 35.0,
    avgBuyPrice: 135.0,
    currentPrice: 154.5,
    marketValue: 5407.5,
    unrealizedPnL: 682.5,
    unrealizedPnLPct: 14.44,
    allocationPct: 0.094,
    network: 'Solana',
  },
  {
    symbol: 'BNB',
    name: 'BNB Vault',
    amount: 8.5,
    avgBuyPrice: 520.0,
    currentPrice: 575.0,
    marketValue: 4887.5,
    unrealizedPnL: 467.5,
    unrealizedPnLPct: 10.58,
    allocationPct: 0.085,
    network: 'BNB Chain',
  },
];

const INITIAL_TRADES: TradeRecord[] = [
  {
    id: 'tx-101',
    timestamp: '2026-09-02 14:15',
    type: 'BUY',
    symbol: 'BTC',
    amount: 0.2,
    price: 61000.0,
    totalUsdt: 12200.0,
    feeUsdt: 9.15,
  },
  {
    id: 'tx-102',
    timestamp: '2026-08-28 11:20',
    type: 'BUY',
    symbol: 'SOL',
    amount: 35.0,
    price: 135.0,
    totalUsdt: 4725.0,
    feeUsdt: 3.54,
  },
  {
    id: 'tx-103',
    timestamp: '2026-08-20 09:00',
    type: 'DEPOSIT',
    symbol: 'USDT',
    totalUsdt: 50000.0,
    feeUsdt: 0,
  },
];

const GENERATE_EQUITY_HISTORY = (currentEquity: number): EquityPoint[] => {
  if (currentEquity <= 0) return [];
  const points: EquityPoint[] = [];
  const days = 30;
  let runningEquity = currentEquity * 0.88;
  let peak = runningEquity;
  let benchmarkVal = 10000;

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dailyReturn = Math.sin(i * 0.7) * 0.015 + 0.004;
    runningEquity = runningEquity * (1 + dailyReturn);
    if (runningEquity > peak) peak = runningEquity;
    const dd = peak > 0 ? ((runningEquity - peak) / peak) * 100 : 0;

    benchmarkVal = benchmarkVal * (1 + dailyReturn * 1.2);

    points.push({
      date: dateStr,
      equity: Math.round(runningEquity),
      benchmark: Math.round(benchmarkVal),
      drawdown: Number(dd.toFixed(2)),
    });
  }

  if (points.length > 0) {
    points[points.length - 1].equity = Math.round(currentEquity);
  }

  return points;
};

export default function CarteraModule() {
  const { override } = useServiceStatusStore();
  const { setActiveRoute } = useUIStore();
  const [activeTab, setActiveTab] = useState<'resumen' | 'equity' | 'money-management' | 'trades'>('resumen');
  const [positions, setPositions] = useState<CryptoPosition[]>(INITIAL_CRYPTO_POSITIONS);
  const [usdtCash] = useState<number>(4850.0);
  const [trades] = useState<TradeRecord[]>(INITIAL_TRADES);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [selectedExoPosition, setSelectedExoPosition] = useState<CryptoPosition | null>(null);

  // Money Management States
  const [riskCapital, setRiskCapital] = useState<number>(57263.5);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.5);
  const [entryPrice, setEntryPrice] = useState<number>(67250);
  const [stopLossPrice, setStopLossPrice] = useState<number>(64500);

  // Kelly Criterion States
  const [winRatePct, setWinRatePct] = useState<number>(62);
  const [rewardRiskRatio, setRewardRiskRatio] = useState<number>(2.2);

  // Maximum Drawdown Budget
  const [maxAllowedDdPct] = useState<number>(15);

  // Real and Auto use positions (preserving user additions or imported assets), never wiped to empty
  const effectivePositions = positions;
  const effectiveUsdtCash = usdtCash;
  const effectiveTrades = trades;

  const totalCryptoValue = effectivePositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCarteraValue = totalCryptoValue + effectiveUsdtCash;
  const totalUnrealizedPnL = effectivePositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalCostBasis = totalCryptoValue - totalUnrealizedPnL;
  const totalReturnPct = totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0;

  const equityHistory = React.useMemo(() => GENERATE_EQUITY_HISTORY(totalCarteraValue), [totalCarteraValue]);
  const currentDrawdown = equityHistory.length ? equityHistory[equityHistory.length - 1].drawdown : 0;
  const maxDrawdown = equityHistory.length ? equityHistory.reduce((min, p) => Math.min(min, p.drawdown), 0) : 0;

  const handleRefreshLivePrices = async () => {
    setRefreshingPrices(true);
    try {
      const updated = await Promise.all(
        positions.map(async (pos) => {
          try {
            const bars = await commands.fetchMarketData(pos.symbol, '1m');
            if (bars && bars.length > 0) {
              const latestClose = bars[bars.length - 1].close;
              const marketVal = pos.amount * latestClose;
              const cost = pos.amount * pos.avgBuyPrice;
              const pnl = marketVal - cost;
              const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
              return {
                ...pos,
                currentPrice: latestClose,
                marketValue: marketVal,
                unrealizedPnL: pnl,
                unrealizedPnLPct: pnlPct,
              };
            }
          } catch (e) {
            console.warn(`Could not refresh price for ${pos.symbol}:`, e);
          }
          return pos;
        })
      );
      setPositions(updated);
    } catch (err) {
      console.error('Error refreshing live Binance prices:', err);
    } finally {
      setRefreshingPrices(false);
    }
  };

  // Money Management Calculations
  const calculatedRiskAmount = riskCapital * (riskPerTradePct / 100);
  const priceDistance = Math.abs(entryPrice - stopLossPrice);
  const stopLossPct = entryPrice > 0 ? (priceDistance / entryPrice) * 100 : 0;
  const calculatedPositionSizeCoins = priceDistance > 0 ? calculatedRiskAmount / priceDistance : 0;
  const calculatedPositionValueUsdt = calculatedPositionSizeCoins * entryPrice;
  const maxPositionAllowedPct = riskCapital > 0 ? (calculatedPositionValueUsdt / riskCapital) * 100 : 0;

  // Kelly Formula: K% = W - [(1 - W) / R]
  const winRateDec = winRatePct / 100;
  const kellyPctFull = Math.max(0, (winRateDec - (1 - winRateDec) / rewardRiskRatio) * 100);
  const kellyPctHalf = kellyPctFull / 2;

  const donutColors = ['#FF6B9D', '#B388FF', '#00F5D4', '#FFE082', '#00E5FF'];
  const pieData: PieSegment[] = effectivePositions.length > 0 ? [
    ...effectivePositions.map((p, idx) => ({
      label: p.symbol,
      value: p.marketValue,
      color: donutColors[idx % donutColors.length],
    })),
    {
      label: 'USDT Liquidez',
      value: effectiveUsdtCash,
      color: '#454C73',
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '40px' }}>
      {/* Header & Sub-Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              className="holo-gradient-text"
              style={{
                fontSize: '1.45rem',
                fontWeight: 900,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              ⚡ Cartera Binance Spot
            </h1>
            {override === 'Real' ? (
              <Badge variant="mint" pulse>
                BINANCE LIVE (REAL)
              </Badge>
            ) : (
              <Badge variant="warning">
                SIMULACIÓN (PAPER CRYPTO)
              </Badge>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Módulo dedicado al seguimiento de PnL Cripto, Equity Curve histórica y herramientas de Money Management / Adm. de Cartera.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshLivePrices}
            isLoading={refreshingPrices}
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            🔄 Actualizar Cotizaciones
          </Button>

          <Button
            variant="holo"
            size="sm"
            onClick={() => setActiveTab('money-management')}
          >
            🛡️ Money Management
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <StatMetric
          label="Valor Total Cartera"
          value={`$${totalCarteraValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={totalReturnPct}
          deltaLabel="Total"
          accentColor="sakura"
          subtext={`Base invertida: $${totalCostBasis.toLocaleString('en-US', { maximumFractionDigits: 0 })} USDT`}
        />

        <StatMetric
          label="P&L No Realizado"
          value={`${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={totalReturnPct}
          deltaLabel="Rendimiento"
          accentColor="mint"
          subtext="Ganancia latente en posiciones abiertas"
        />

        <StatMetric
          label="Liquidez Disponible (USDT)"
          value={`$${usdtCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accentColor="lavender"
          subtext={`${((usdtCash / totalCarteraValue) * 100).toFixed(1)}% del portafolio en caja`}
        />

        <StatMetric
          label="Drawdown Actual"
          value={`${currentDrawdown.toFixed(2)}%`}
          delta={maxDrawdown}
          deltaLabel="Max DD Histórico"
          accentColor="peach"
          subtext="Distancia respecto al pico histórico"
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <Button
          variant={activeTab === 'resumen' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('resumen')}
        >
          📊 Resumen & Posiciones
        </Button>
        <Button
          variant={activeTab === 'equity' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('equity')}
        >
          📈 Equity Curve & Rendimiento
        </Button>
        <Button
          variant={activeTab === 'money-management' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('money-management')}
        >
          🛡️ Money Management & Kelly
        </Button>
        <Button
          variant={activeTab === 'trades' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('trades')}
        >
          📜 Registro Operativo
        </Button>
      </div>

      {/* TAB 1: Resumen & Posiciones */}
      {activeTab === 'resumen' && (
        effectivePositions.length === 0 ? (
          <Card style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.04)' }}>
            <div style={{ fontSize: '2.5rem' }}>🔴</div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              MODO REAL ACTIVO: CUENTA BINANCE NO CONECTADA / DESINCRONIZADA
            </h3>
            <p style={{ margin: 0, maxWidth: '620px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El terminal se encuentra operando en <strong>Modo Real (Live Data Engine)</strong>. Las tenencias simuladas han sido puestas en cero ($0.00 USDT) para garantizar la integridad contable.
              Para ver tu saldo real de Binance, tenencias en custodia y ejecutar órdenes en vivo, vinculá tus credenciales API.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <Button variant="mint" size="md" onClick={() => setActiveRoute('/providers')}>
                🔗 Conectar Binance API en Proveedores
              </Button>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
              <Card variant="glass" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                    Asignación de Activos Cripto 🪙
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {effectivePositions.length} activos + Liquidez
                  </span>
                </div>
                <DonutChart
                  data={pieData}
                  centerText={`$${(totalCarteraValue / 1000).toFixed(1)}k`}
                  centerSubtext="Total USDT"
                />
              </Card>

              <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Diagnóstico de Diversificación 🛡️
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Exposición Neta Cripto:</span>
                    <strong className="font-mono" style={{ color: 'var(--text-bright)' }}>
                      {totalCarteraValue > 0 ? ((totalCryptoValue / totalCarteraValue) * 100).toFixed(1) : '0.0'}% ({effectivePositions.length} activos)
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reserva de Liquidez USDT:</span>
                    <strong className="font-mono" style={{ color: 'var(--accent-mint)' }}>
                      ${effectiveUsdtCash.toLocaleString()} ({totalCarteraValue > 0 ? ((effectiveUsdtCash / totalCarteraValue) * 100).toFixed(1) : '0.0'}%)
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dominancia Bitcoin (BTC):</span>
                    <strong className="font-mono" style={{ color: 'var(--accent-sakura)' }}>
                      {effectivePositions.find((p) => p.symbol === 'BTC') && totalCarteraValue > 0 ? `${((effectivePositions.find((p) => p.symbol === 'BTC')!.marketValue / totalCarteraValue) * 100).toFixed(1)}%` : '0%'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Concentración Top 2 Activos:</span>
                    <strong className="font-mono" style={{ color: 'var(--text-bright)' }}>
                      {totalCarteraValue > 0 ? (((effectivePositions[0]?.marketValue || 0) + (effectivePositions[1]?.marketValue || 0)) / totalCarteraValue * 100).toFixed(1) : '0.0'}%
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Estado de Riesgo:</span>
                    <Badge variant="mint">
                      EQUILIBRADO CONSERVADOR
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                Posiciones Spot en Binance
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Precios sincronizados con Binance Spot Klines
              </span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <table className="institutional-table">
                <thead>
                  <tr>
                    <th>Activo</th>
                    <th>Cantidad</th>
                    <th>Precio Compra</th>
                    <th>Precio Binance</th>
                    <th>Valor Mercado</th>
                    <th>P&L ($)</th>
                    <th>P&L (%)</th>
                    <th>Peso</th>
                    <th style={{ textAlign: 'center' }}>Gestión EXO / UTs</th>
                  </tr>
                </thead>
                <tbody>
                  {effectivePositions.map((p) => (
                    <tr
                      key={p.symbol}
                      className={p.unrealizedPnL >= 0 ? 'row-bullish' : 'row-bearish'}
                    >
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-bright)' }}>{p.symbol}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({p.name})</span>
                        </div>
                      </td>
                      <td className="font-mono" style={{ padding: '9px 14px' }}>{p.amount}</td>
                      <td className="font-mono" style={{ padding: '9px 14px' }}>${p.avgBuyPrice.toLocaleString()}</td>
                      <td className="font-mono" style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--accent-mint)' }}>
                        ${p.currentPrice.toLocaleString()}
                      </td>
                      <td className="font-mono" style={{ padding: '9px 14px', fontWeight: 700 }}>
                        ${p.marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          padding: '9px 14px',
                          fontWeight: 700,
                          color: p.unrealizedPnL >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)',
                        }}
                      >
                        {p.unrealizedPnL >= 0 ? '+' : ''}${p.unrealizedPnL.toFixed(2)}
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          padding: '9px 14px',
                          fontWeight: 700,
                          color: p.unrealizedPnLPct >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)',
                        }}
                      >
                        {p.unrealizedPnLPct >= 0 ? '+' : ''}{p.unrealizedPnLPct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px' }}>
                          <div style={{ flex: 1, height: '5px', backgroundColor: 'var(--bg-canvas)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${(p.marketValue / totalCarteraValue) * 100}%`,
                                height: '100%',
                                background: 'var(--holo-gradient)',
                              }}
                            />
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                            {((p.marketValue / totalCarteraValue) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <Button
                          size="sm"
                          variant="holo"
                          onClick={() => setSelectedExoPosition(p)}
                          style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                        >
                          📐 EXO / VWAP
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )
    )}

      {/* TAB 2: Equity Curve con TradingView Lightweight Charts & Métricas */}
      {activeTab === 'equity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <EquityCurveChart
            totalEquity={totalCarteraValue}
            onOpenInChartModule={() => setActiveRoute('/chart')}
          />
          <RiskReturnMetricsCard />
        </div>
      )}

      {/* TAB 3: Money Management & Kelly */}
      {activeTab === 'money-management' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            <Card variant="holo" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                  📐 Position Sizer (Riesgo Fijo por Operación)
                </h3>
                <Badge variant="sakura">MONEY MANAGEMENT</Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Calcula exactamente cuántas unidades comprar según tu presupuesto de riesgo y la distancia al Stop Loss.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Capital Total ($USDT):</label>
                  <input
                    type="number"
                    value={riskCapital}
                    onChange={(e) => setRiskCapital(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Riesgo Máximo (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={riskPerTradePct}
                    onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-sakura)', fontWeight: 700, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Precio de Entrada ($):</label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Precio Stop Loss ($):</label>
                  <input
                    type="number"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--signal-bearish)', fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Riesgo Monetario Máximo:</span>
                  <strong className="font-mono" style={{ color: 'var(--signal-bearish)' }}>${calculatedRiskAmount.toFixed(2)} USDT</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Distancia al Stop Loss:</span>
                  <strong className="font-mono">{stopLossPct.toFixed(2)}% (${priceDistance.toFixed(2)})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>Posición Sugerida (Monedas):</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-mint)', fontSize: '1rem' }}>{calculatedPositionSizeCoins.toFixed(4)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Valor de la Posición en USDT:</span>
                  <strong className="font-mono">${calculatedPositionValueUsdt.toFixed(2)} ({maxPositionAllowedPct.toFixed(1)}% cartera)</strong>
                </div>
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                  🧠 Criterio de Kelly (Optimal Growth)
                </h3>
                <Badge variant="lavender">KELLY CRITERION</Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Optimiza la tasa de crecimiento del capital minimizando la probabilidad de ruina estocástica.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Win Rate Histórico (%):</label>
                  <input
                    type="number"
                    value={winRatePct}
                    onChange={(e) => setWinRatePct(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Payoff Ratio (Ganancia / Pérdida):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rewardRiskRatio}
                    onChange={(e) => setRewardRiskRatio(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-lavender)', fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Kelly Completo (Full Kelly):</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-peach)' }}>{kellyPctFull.toFixed(2)}% del capital</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--accent-lavender)', fontWeight: 700 }}>Half-Kelly (Recomendado Institucional):</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-lavender)', fontSize: '1rem' }}>{kellyPctHalf.toFixed(2)}%</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  * El Half-Kelly reduce la volatilidad de la curva de capital en un 50% conservando el 75% del crecimiento óptimo.
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              ⚡ Presupuesto de Drawdown & Value at Risk (VaR 95%)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Límite de Drawdown Permitido</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-peach)', marginTop: '4px' }}>
                  {maxAllowedDdPct}% (${((totalCarteraValue * maxAllowedDdPct) / 100).toFixed(0)} USDT)
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Tolerancia a Racha Perdedora</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>
                  {Math.floor(maxAllowedDdPct / riskPerTradePct)} trades consecutivos
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Value at Risk Diario (95%)</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--signal-bearish)', marginTop: '4px' }}>
                  ${(totalCarteraValue * 0.038).toFixed(2)} USDT (3.8%)
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Registro Operativo */}
      {activeTab === 'trades' && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              Registro de Operaciones & Órdenes en Binance Spot
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {effectiveTrades.length} operaciones registradas
            </span>
          </div>

          {effectiveTrades.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No hay operaciones reales registradas en el historial contable.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <table className="institutional-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Tipo</th>
                    <th>Símbolo</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total USDT</th>
                    <th>Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveTrades.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{t.timestamp}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge variant={t.type === 'BUY' ? 'mint' : t.type === 'SELL' ? 'bearish' : 'lavender'}>
                          {t.type}
                        </Badge>
                      </td>
                      <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-bright)' }}>{t.symbol}</td>
                      <td className="font-mono" style={{ padding: '8px 12px' }}>{t.amount || '-'}</td>
                      <td className="font-mono" style={{ padding: '8px 12px' }}>{t.price ? `$${t.price.toLocaleString()}` : '-'}</td>
                      <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 700 }}>${t.totalUsdt.toLocaleString()}</td>
                      <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>${t.feeUsdt?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selectedExoPosition && (
        <ExoPositionManagerModal
          symbol={selectedExoPosition.symbol}
          initialEntryPrice={selectedExoPosition.avgBuyPrice}
          initialCurrentPrice={selectedExoPosition.currentPrice}
          shares={selectedExoPosition.amount}
          onClose={() => setSelectedExoPosition(null)}
        />
      )}
    </div>
  );
}
