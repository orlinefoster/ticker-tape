import React, { useState } from 'react';
import { Card, Button, Badge, StatMetric } from '@/components/ui';
import { DonutChart, type PieSegment } from '@/components/DonutChart';
import { commands } from '@/lib/tauri';

export type IOLAssetType = 'CEDEAR' | 'MERVAL' | 'BONO_SOBERANO' | 'ON_CORPORATIVA' | 'FCI_CAUCION';

export interface IOLPosition {
  symbol: string;
  name: string;
  assetType: IOLAssetType;
  nominalQuantity: number;
  avgBuyPriceArs: number;
  currentPriceArs: number;
  marketValueArs: number;
  marketValueUsdMep: number;
  unrealizedPnLArs: number;
  unrealizedPnLPct: number;
  cedearRatio?: string;
  currencyExposure: 'USD_CCL' | 'USD_MEP' | 'ARS_NOMINAL' | 'CER';
}

export interface IOLOrderRecord {
  id: string;
  timestamp: string;
  type: 'COMPRA' | 'VENTA' | 'DIVIDENDO_USD' | 'RENTA_BONO' | 'DEPOSITO_ARS' | 'EXTRACCION';
  symbol: string;
  nominalQuantity?: number;
  priceArs?: number;
  totalArs: number;
  commissionArs: number;
}

export interface IOLEquityPoint {
  date: string;
  equityArs: number;
  equityUsd: number;
  drawdown: number;
}

const INITIAL_IOL_POSITIONS: IOLPosition[] = [
  {
    symbol: 'SPY',
    name: 'CEDEAR S&P 500 (SPDR)',
    assetType: 'CEDEAR',
    nominalQuantity: 180,
    avgBuyPriceArs: 29500.0,
    currentPriceArs: 32800.0,
    marketValueArs: 5904000.0,
    marketValueUsdMep: 4541.5,
    unrealizedPnLArs: 594000.0,
    unrealizedPnLPct: 11.18,
    cedearRatio: '20:1',
    currencyExposure: 'USD_CCL',
  },
  {
    symbol: 'AAPL',
    name: 'CEDEAR Apple Inc.',
    assetType: 'CEDEAR',
    nominalQuantity: 240,
    avgBuyPriceArs: 14200.0,
    currentPriceArs: 16150.0,
    marketValueArs: 3876000.0,
    marketValueUsdMep: 2981.5,
    unrealizedPnLArs: 468000.0,
    unrealizedPnLPct: 13.73,
    cedearRatio: '10:1',
    currencyExposure: 'USD_CCL',
  },
  {
    symbol: 'GGAL',
    name: 'Grupo Financiero Galicia (Acción Local)',
    assetType: 'MERVAL',
    nominalQuantity: 450,
    avgBuyPriceArs: 5200.0,
    currentPriceArs: 6150.0,
    marketValueArs: 2767500.0,
    marketValueUsdMep: 2128.8,
    unrealizedPnLArs: 427500.0,
    unrealizedPnLPct: 18.26,
    currencyExposure: 'ARS_NOMINAL',
  },
  {
    symbol: 'GD30',
    name: 'Bono Global 2030 Ley Extranjera',
    assetType: 'BONO_SOBERANO',
    nominalQuantity: 3500,
    avgBuyPriceArs: 740.0,
    currentPriceArs: 825.0,
    marketValueArs: 2887500.0,
    marketValueUsdMep: 2221.1,
    unrealizedPnLArs: 297500.0,
    unrealizedPnLPct: 11.48,
    currencyExposure: 'USD_MEP',
  },
  {
    symbol: 'YMCIO',
    name: 'ON YPF Clase XVI USD',
    assetType: 'ON_CORPORATIVA',
    nominalQuantity: 2000,
    avgBuyPriceArs: 1250.0,
    currentPriceArs: 1310.0,
    marketValueArs: 2620000.0,
    marketValueUsdMep: 2015.3,
    unrealizedPnLArs: 120000.0,
    unrealizedPnLPct: 4.8,
    currencyExposure: 'USD_MEP',
  },
];

const INITIAL_IOL_TRADES: IOLOrderRecord[] = [
  {
    id: 'iol-401',
    timestamp: '2026-09-04 15:20',
    type: 'COMPRA',
    symbol: 'SPY',
    nominalQuantity: 50,
    priceArs: 31200.0,
    totalArs: 1560000.0,
    commissionArs: 7800.0,
  },
  {
    id: 'iol-402',
    timestamp: '2026-08-27 12:45',
    type: 'COMPRA',
    symbol: 'GD30',
    nominalQuantity: 1500,
    priceArs: 780.0,
    totalArs: 1170000.0,
    commissionArs: 5850.0,
  },
  {
    id: 'iol-403',
    timestamp: '2026-08-15 10:00',
    type: 'DEPOSITO_ARS',
    symbol: 'PESOS',
    totalArs: 10000000.0,
    commissionArs: 0,
  },
];

const GENERATE_IOL_EQUITY = (totalArs: number, mepRate: number): IOLEquityPoint[] => {
  const points: IOLEquityPoint[] = [];
  const days = 30;
  let runningArs = totalArs * 0.86;
  let peakArs = runningArs;

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dailyArsReturn = Math.sin(i * 0.65) * 0.012 + 0.005;
    runningArs = runningArs * (1 + dailyArsReturn);
    if (runningArs > peakArs) peakArs = runningArs;
    const dd = ((runningArs - peakArs) / peakArs) * 100;

    points.push({
      date: dateStr,
      equityArs: Math.round(runningArs),
      equityUsd: Number((runningArs / mepRate).toFixed(2)),
      drawdown: Number(dd.toFixed(2)),
    });
  }

  if (points.length > 0) {
    points[points.length - 1].equityArs = Math.round(totalArs);
    points[points.length - 1].equityUsd = Number((totalArs / mepRate).toFixed(2));
  }

  return points;
};

export default function CarteraIOLModule() {
  const [activeTab, setActiveTab] = useState<'resumen' | 'equity' | 'money-management' | 'trades'>('resumen');
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD_MEP'>('ARS');
  const [positions, setPositions] = useState<IOLPosition[]>(INITIAL_IOL_POSITIONS);
  const [cashArs] = useState<number>(1450000.0);
  const [cashUsdMep] = useState<number>(1200.0);
  const [mepExchangeRate, setMepExchangeRate] = useState<number>(1300.0);
  const [trades] = useState<IOLOrderRecord[]>(INITIAL_IOL_TRADES);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // Money Management Calculator States
  const [riskCapitalArs, setRiskCapitalArs] = useState<number>(19505000);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.5);
  const [entryPriceArs, setEntryPriceArs] = useState<number>(32800);
  const [stopLossPriceArs, setStopLossPriceArs] = useState<number>(30500);

  // Kelly Calculator States
  const [winRatePct, setWinRatePct] = useState<number>(60);
  const [rewardRiskRatio, setRewardRiskRatio] = useState<number>(2.4);

  // Portfolio Max Drawdown Limit
  const [maxAllowedDdPct] = useState<number>(12);

  const totalInvestedArs = positions.reduce((sum, p) => sum + p.marketValueArs, 0);
  const totalCarteraArs = totalInvestedArs + cashArs + (cashUsdMep * mepExchangeRate);
  const totalCarteraUsdMep = totalCarteraArs / mepExchangeRate;
  const totalUnrealizedPnLArs = positions.reduce((sum, p) => sum + p.unrealizedPnLArs, 0);
  const totalCostBasisArs = totalInvestedArs - totalUnrealizedPnLArs;
  const totalReturnPct = totalCostBasisArs > 0 ? (totalUnrealizedPnLArs / totalCostBasisArs) * 100 : 0;

  const equityHistory = React.useMemo(() => GENERATE_IOL_EQUITY(totalCarteraArs, mepExchangeRate), [totalCarteraArs, mepExchangeRate]);
  const currentDrawdown = equityHistory.length ? equityHistory[equityHistory.length - 1].drawdown : 0;
  const maxDrawdown = equityHistory.reduce((min, p) => Math.min(min, p.drawdown), 0);

  // Currency Exposure Breakdown
  const usdExposureArs = positions
    .filter((p) => p.currencyExposure === 'USD_CCL' || p.currencyExposure === 'USD_MEP')
    .reduce((sum, p) => sum + p.marketValueArs, 0) + (cashUsdMep * mepExchangeRate);
  const usdExposurePct = totalCarteraArs > 0 ? (usdExposureArs / totalCarteraArs) * 100 : 0;
  const arsExposurePct = 100 - usdExposurePct;

  // Refresh prices via Yahoo Finance / local provider
  const handleRefreshLivePrices = async () => {
    setRefreshingPrices(true);
    try {
      const updated = await Promise.all(
        positions.map(async (pos) => {
          try {
            const bars = await commands.fetchMarketData(pos.symbol, '1m');
            if (bars && bars.length > 0) {
              const latestClose = bars[bars.length - 1].close;
              const ratioMultiplier = pos.assetType === 'CEDEAR' ? (mepExchangeRate / 20) : 1;
              const approxArsPrice = latestClose * ratioMultiplier;
              const marketValArs = pos.nominalQuantity * approxArsPrice;
              const costArs = pos.nominalQuantity * pos.avgBuyPriceArs;
              const pnlArs = marketValArs - costArs;
              const pnlPct = costArs > 0 ? (pnlArs / costArs) * 100 : 0;
              return {
                ...pos,
                currentPriceArs: Math.round(approxArsPrice),
                marketValueArs: marketValArs,
                marketValueUsdMep: marketValArs / mepExchangeRate,
                unrealizedPnLArs: pnlArs,
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
      console.error('Error refreshing live IOL prices:', err);
    } finally {
      setRefreshingPrices(false);
    }
  };

  // Money Management Calculations
  const calculatedRiskAmountArs = riskCapitalArs * (riskPerTradePct / 100);
  const priceDistanceArs = Math.abs(entryPriceArs - stopLossPriceArs);
  const stopLossPct = entryPriceArs > 0 ? (priceDistanceArs / entryPriceArs) * 100 : 0;
  const calculatedNominals = priceDistanceArs > 0 ? Math.floor(calculatedRiskAmountArs / priceDistanceArs) : 0;
  const calculatedOrderValueArs = calculatedNominals * entryPriceArs;
  const calculatedOrderValueUsd = calculatedOrderValueArs / mepExchangeRate;

  // Kelly Formula: K% = W - [(1 - W) / R]
  const winRateDec = winRatePct / 100;
  const kellyPctFull = Math.max(0, (winRateDec - (1 - winRateDec) / rewardRiskRatio) * 100);
  const kellyPctHalf = kellyPctFull / 2;

  // Donut Chart by Asset Type
  const assetTypeTotals: Record<string, number> = {};
  positions.forEach((p) => {
    assetTypeTotals[p.assetType] = (assetTypeTotals[p.assetType] || 0) + p.marketValueArs;
  });
  assetTypeTotals['LIQUIDEZ'] = cashArs + (cashUsdMep * mepExchangeRate);

  const pieData: PieSegment[] = [
    { label: 'CEDEARs (USA)', value: assetTypeTotals['CEDEAR'] || 0, color: '#FF6B9D' },
    { label: 'Acciones Merval', value: assetTypeTotals['MERVAL'] || 0, color: '#B388FF' },
    { label: 'Bonos Soberanos', value: assetTypeTotals['BONO_SOBERANO'] || 0, color: '#00F5D4' },
    { label: 'Obligaciones Neg.', value: assetTypeTotals['ON_CORPORATIVA'] || 0, color: '#FFE082' },
    { label: 'Caja & Liquidez', value: assetTypeTotals['LIQUIDEZ'] || 0, color: '#454C73' },
  ].filter((p) => p.value > 0);

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
              🇦🇷 Cartera Broker IOL (InvertirOnline)
            </h1>
            <Badge variant="sakura" pulse>
              IOL BROKER
            </Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Módulo dedicado para CEDEARs, Acciones del Merval (BYMA), Bonos y ONs con seguimiento de PnL y cobertura cambiaria.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Currency Toggle (ARS / USD MEP) */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setDisplayCurrency('ARS')}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: displayCurrency === 'ARS' ? 'var(--accent-sakura)' : 'transparent',
                color: displayCurrency === 'ARS' ? '#0B0D17' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              $ ARS
            </button>
            <button
              onClick={() => setDisplayCurrency('USD_MEP')}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: displayCurrency === 'USD_MEP' ? 'var(--accent-mint)' : 'transparent',
                color: displayCurrency === 'USD_MEP' ? '#0B0D17' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              u$s MEP
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshLivePrices}
            isLoading={refreshingPrices}
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            🔄 Cotizaciones IOL
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
          label={displayCurrency === 'ARS' ? 'Valor Total Cartera (ARS)' : 'Valor Total Cartera (MEP)'}
          value={
            displayCurrency === 'ARS'
              ? `$${totalCarteraArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
              : `u$s ${totalCarteraUsdMep.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          delta={totalReturnPct}
          deltaLabel="Rendimiento"
          accentColor="sakura"
          subtext={`Dólar MEP Referencia: $${mepExchangeRate.toFixed(0)} ARS`}
        />

        <StatMetric
          label="P&L No Realizado (ARS)"
          value={`${totalUnrealizedPnLArs >= 0 ? '+' : ''}$${totalUnrealizedPnLArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
          delta={totalReturnPct}
          deltaLabel="Total"
          accentColor="mint"
          subtext={`u$s ${(totalUnrealizedPnLArs / mepExchangeRate).toFixed(1)} MEP latente`}
        />

        <StatMetric
          label="Cobertura Dólar (Hard USD / CCL)"
          value={`${usdExposurePct.toFixed(1)}%`}
          accentColor="lavender"
          subtext={`${arsExposurePct.toFixed(1)}% en pesos nominales / Merval`}
        />

        <StatMetric
          label="Drawdown Actual (ARS)"
          value={`${currentDrawdown.toFixed(2)}%`}
          delta={maxDrawdown}
          deltaLabel="Max Histórico"
          accentColor="peach"
          subtext="Distancia respecto al pico en pesos"
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <Button
          variant={activeTab === 'resumen' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('resumen')}
        >
          📊 Resumen & Posiciones BYMA
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
          🛡️ Money Management & Posición
        </Button>
        <Button
          variant={activeTab === 'trades' ? 'holo' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('trades')}
        >
          📜 Boletos de Operaciones
        </Button>
      </div>

      {/* TAB 1: Resumen & Posiciones */}
      {activeTab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            <Card variant="glass" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Asignación por Clase de Activo 📊
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  CEDEARs, Merval, Bonos & Liquidez
                </span>
              </div>
              <DonutChart
                data={pieData}
                centerText={
                  displayCurrency === 'ARS'
                    ? `$${(totalCarteraArs / 1000000).toFixed(1)}M`
                    : `$${(totalCarteraUsdMep / 1000).toFixed(1)}k`
                }
                centerSubtext={displayCurrency === 'ARS' ? 'Total ARS' : 'Total MEP'}
              />
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                Liquidez y Cotización Cambiaria 💵
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disponible en Pesos (ARS):</span>
                  <strong className="font-mono" style={{ color: 'var(--text-bright)' }}>
                    ${cashArs.toLocaleString('es-AR')}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disponible en Dólar MEP:</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-mint)' }}>
                    u$s {cashUsdMep.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cotización Dólar MEP ($):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      value={mepExchangeRate}
                      onChange={(e) => setMepExchangeRate(Number(e.target.value))}
                      className="font-mono"
                      style={{
                        width: '80px',
                        padding: '3px 6px',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent-sakura)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Perfil de Exposición:</span>
                  <Badge variant={usdExposurePct >= 70 ? 'mint' : 'peach'}>
                    {usdExposurePct >= 70 ? 'DOLARIZADO ALTO' : 'MIXTO ARS/USD'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                Posiciones de Custodia en IOL (BYMA)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Valores actualizados en pesos argentinos y dólares MEP
              </span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>Especie</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>Tipo</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>Nominales</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>P. Compra</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>P. Actual</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>
                      {displayCurrency === 'ARS' ? 'Valor Mercado ($)' : 'Valor MEP (u$s)'}
                    </th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>P&L ($)</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>P&L (%)</th>
                    <th style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, idx) => (
                    <tr
                      key={p.symbol}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 107, 157, 0.02)',
                      }}
                    >
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-bright)' }}>{p.symbol}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.cedearRatio ? `[${p.cedearRatio}]` : ''}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <Badge variant={p.assetType === 'CEDEAR' ? 'sakura' : p.assetType === 'MERVAL' ? 'lavender' : 'mint'}>
                          {p.assetType}
                        </Badge>
                      </td>
                      <td className="font-mono" style={{ padding: '9px 14px' }}>{p.nominalQuantity.toLocaleString()}</td>
                      <td className="font-mono" style={{ padding: '9px 14px' }}>${p.avgBuyPriceArs.toLocaleString()}</td>
                      <td className="font-mono" style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--accent-mint)' }}>
                        ${p.currentPriceArs.toLocaleString()}
                      </td>
                      <td className="font-mono" style={{ padding: '9px 14px', fontWeight: 700 }}>
                        {displayCurrency === 'ARS'
                          ? `$${p.marketValueArs.toLocaleString('es-AR')}`
                          : `u$s ${p.marketValueUsdMep.toFixed(1)}`}
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          padding: '9px 14px',
                          fontWeight: 700,
                          color: p.unrealizedPnLArs >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)',
                        }}
                      >
                        {p.unrealizedPnLArs >= 0 ? '+' : ''}${p.unrealizedPnLArs.toLocaleString()}
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
                                width: `${(p.marketValueArs / totalCarteraArs) * 100}%`,
                                height: '100%',
                                background: 'var(--holo-gradient)',
                              }}
                            />
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                            {((p.marketValueArs / totalCarteraArs) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Equity Curve & Rendimiento */}
      {activeTab === 'equity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card variant="glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  📈 Curva de Capital Cartera IOL ({displayCurrency === 'ARS' ? 'Pesos ARS' : 'Dólar MEP'})
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Evolución del saldo consolidado de la cuenta de inversión en los últimos 30 días.
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: '240px', position: 'relative', marginTop: '8px' }}>
              <svg viewBox="0 0 800 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="iolSheen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F5D4" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#B388FF" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0B0D17" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="60" x2="800" y2="60" stroke="rgba(255, 107, 157, 0.08)" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(255, 107, 157, 0.08)" strokeDasharray="4 4" />
                <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(255, 107, 157, 0.08)" strokeDasharray="4 4" />

                {(() => {
                  const values = equityHistory.map((p) => displayCurrency === 'ARS' ? p.equityArs : p.equityUsd);
                  const minEq = Math.min(...values) * 0.98;
                  const maxEq = Math.max(...values) * 1.02;
                  const rangeY = maxEq - minEq || 1;

                  const points = values.map((val, i) => {
                    const x = (i / (values.length - 1)) * 800;
                    const y = 220 - ((val - minEq) / rangeY) * 200;
                    return `${x},${y}`;
                  });

                  const pathD = `M 0,220 L ${points.join(' L ')} L 800,220 Z`;
                  const lineD = `M ${points.join(' L ')}`;

                  return (
                    <>
                      <path d={pathD} fill="url(#iolSheen)" />
                      <path d={lineD} fill="none" stroke="var(--accent-mint)" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 245, 212, 0.5))' }} />
                    </>
                  );
                })()}
              </svg>
            </div>
          </Card>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                🌊 Curva de Drawdown Submarino en IOL
              </h3>
              <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--signal-bearish)', fontWeight: 700 }}>
                Max Drawdown: {maxDrawdown.toFixed(2)}%
              </span>
            </div>

            <div style={{ width: '100%', height: '120px', position: 'relative' }}>
              <svg viewBox="0 0 800 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <line x1="0" y1="15" x2="800" y2="15" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                {(() => {
                  const minDD = Math.min(-10, maxDrawdown * 1.2);
                  const points = equityHistory.map((p, i) => {
                    const x = (i / (equityHistory.length - 1)) * 800;
                    const y = 15 + (Math.abs(p.drawdown) / Math.abs(minDD)) * 95;
                    return `${x},${y}`;
                  });

                  const pathD = `M 0,15 L ${points.join(' L ')} L 800,15 Z`;
                  const lineD = `M ${points.join(' L ')}`;

                  return (
                    <>
                      <path d={pathD} fill="rgba(255, 51, 102, 0.2)" />
                      <path d={lineD} fill="none" stroke="var(--signal-bearish)" strokeWidth="2" />
                    </>
                  );
                })()}
              </svg>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Money Management & Adm. de Cartera IOL */}
      {activeTab === 'money-management' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            <Card variant="holo" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                  📐 Dimensionador de Posición en BYMA (Fixed Risk)
                </h3>
                <Badge variant="sakura">MONEY MANAGEMENT ARS</Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Calcula la cantidad exacta de nominales a comprar en IOL para no arriesgar más de tu presupuesto prefijado.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Capital Total en ARS:</label>
                  <input
                    type="number"
                    value={riskCapitalArs}
                    onChange={(e) => setRiskCapitalArs(Number(e.target.value))}
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
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Precio de Entrada ($ ARS):</label>
                  <input
                    type="number"
                    value={entryPriceArs}
                    onChange={(e) => setEntryPriceArs(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Precio Stop Loss ($ ARS):</label>
                  <input
                    type="number"
                    value={stopLossPriceArs}
                    onChange={(e) => setStopLossPriceArs(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--signal-bearish)', fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Riesgo Monetario Máximo:</span>
                  <strong className="font-mono" style={{ color: 'var(--signal-bearish)' }}>${calculatedRiskAmountArs.toLocaleString()} ARS</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Distancia al Stop Loss:</span>
                  <strong className="font-mono">{stopLossPct.toFixed(2)}% (${priceDistanceArs.toLocaleString()} ARS)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>Cantidad Sugerida de Nominales:</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-mint)', fontSize: '1rem' }}>{calculatedNominals.toLocaleString()} nominales</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Valor de la Orden en Pesos:</span>
                  <strong className="font-mono">${calculatedOrderValueArs.toLocaleString()} ARS (~u$s {calculatedOrderValueUsd.toFixed(1)} MEP)</strong>
                </div>
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                  🧠 Criterio de Kelly para Cartera IOL
                </h3>
                <Badge variant="lavender">KELLY CRITERION</Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Modelado matemático para maximizar el crecimiento compuesto ajustado por volatilidad argentina.
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
                  <span style={{ color: 'var(--accent-lavender)', fontWeight: 700 }}>Half-Kelly (Óptimo Prudente):</span>
                  <strong className="font-mono" style={{ color: 'var(--accent-lavender)', fontSize: '1rem' }}>{kellyPctHalf.toFixed(2)}%</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  * En mercados volátiles como el Merval, se recomienda operar a Half-Kelly o Quarter-Kelly.
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
              ⚡ Presupuesto de Drawdown & Value at Risk (VaR 95% ARS)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Límite de Drawdown en Pesos</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-peach)', marginTop: '4px' }}>
                  {maxAllowedDdPct}% (${((totalCarteraArs * maxAllowedDdPct) / 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS)
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Tolerancia a Racha Perdedora</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>
                  {Math.floor(maxAllowedDdPct / riskPerTradePct)} operaciones consecutivas
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Value at Risk Diario (95%)</div>
                <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--signal-bearish)', marginTop: '4px' }}>
                  ${(totalCarteraArs * 0.026).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS (2.6%)
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Boletos de Operaciones */}
      {activeTab === 'trades' && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              Boletos y Registro de Órdenes en InvertirOnline (BYMA)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {trades.length} operaciones registradas
            </span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Boleto / Fecha</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Tipo</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Especie</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Nominales</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Precio Unitario</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Monto Bruto</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Derechos & Comisiones</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 107, 157, 0.02)',
                    }}
                  >
                    <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{t.timestamp}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge variant={t.type === 'COMPRA' ? 'mint' : t.type === 'VENTA' ? 'bearish' : 'lavender'}>
                        {t.type}
                      </Badge>
                    </td>
                    <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-bright)' }}>{t.symbol}</td>
                    <td className="font-mono" style={{ padding: '8px 12px' }}>{t.nominalQuantity?.toLocaleString() || '-'}</td>
                    <td className="font-mono" style={{ padding: '8px 12px' }}>{t.priceArs ? `$${t.priceArs.toLocaleString()}` : '-'}</td>
                    <td className="font-mono" style={{ padding: '8px 12px', fontWeight: 700 }}>${t.totalArs.toLocaleString()}</td>
                    <td className="font-mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>${t.commissionArs.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
