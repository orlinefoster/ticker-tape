import React, { useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { DonutChart, type PieSegment } from '@/components/DonutChart';

interface Position {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  allocationPct: number;
}

interface OrderRecord {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  symbol: string;
  shares?: number;
  price?: number;
  totalAmount: number;
}

const COLOR_PALETTE = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#e91e63', '#00bcd4', '#ff5722', '#607d8b'];

const INITIAL_POSITIONS: Position[] = [
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    shares: 120,
    avgPrice: 510.5,
    currentPrice: 545.2,
    marketValue: 65424.0,
    unrealizedPl: 4164.0,
    unrealizedPlPct: 0.0679,
    allocationPct: 0.436,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    shares: 80,
    avgPrice: 440.0,
    currentPrice: 485.6,
    marketValue: 38848.0,
    unrealizedPl: 3648.0,
    unrealizedPlPct: 0.1036,
    allocationPct: 0.259,
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin Spot Proxy',
    shares: 0.35,
    avgPrice: 62000.0,
    currentPrice: 66800.0,
    marketValue: 23380.0,
    unrealizedPl: 1680.0,
    unrealizedPlPct: 0.0774,
    allocationPct: 0.156,
  },
  {
    symbol: 'GLD',
    name: 'SPDR Gold Shares',
    shares: 55,
    avgPrice: 215.0,
    currentPrice: 228.4,
    marketValue: 12562.0,
    unrealizedPl: 737.0,
    unrealizedPlPct: 0.0623,
    allocationPct: 0.084,
  },
];

const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: '1',
    timestamp: '2026-08-19 14:32',
    type: 'BUY',
    symbol: 'SPY',
    shares: 120,
    price: 510.5,
    totalAmount: 61260.0,
  },
  {
    id: '2',
    timestamp: '2026-08-18 10:15',
    type: 'BUY',
    symbol: 'QQQ',
    shares: 80,
    price: 440.0,
    totalAmount: 35200.0,
  },
  {
    id: '3',
    timestamp: '2026-08-15 09:00',
    type: 'DEPOSIT',
    symbol: 'CASH',
    totalAmount: 100000.0,
  },
];

export default function PortfolioModule() {
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [cash, setCash] = useState<number>(9850.0);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);

  // New Position Form
  const [newSymbol, setNewSymbol] = useState('TLT');
  const [newShares, setNewShares] = useState(25);
  const [newPrice, setNewPrice] = useState(92.5);

  // Cash Adjustment
  const [cashDelta, setCashDelta] = useState<number>(1000);

  const totalInvested = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalValue = totalInvested + cash;
  const totalUnrealizedPl = positions.reduce((sum, p) => sum + p.unrealizedPl, 0);
  const totalCostBasis = totalInvested - totalUnrealizedPl;
  const totalReturnPct = totalCostBasis > 0 ? totalUnrealizedPl / totalCostBasis : 0;

  // Best / Worst performers
  const topPerformer = positions.length
    ? [...positions].sort((a, b) => b.unrealizedPlPct - a.unrealizedPlPct)[0]
    : null;
  const worstPerformer = positions.length
    ? [...positions].sort((a, b) => a.unrealizedPlPct - b.unrealizedPlPct)[0]
    : null;

  // Prepare Pie Data
  const pieData: PieSegment[] = [
    ...positions.map((p, idx) => ({
      label: p.symbol,
      value: p.marketValue,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    })),
    {
      label: 'Caja (USD)',
      value: cash,
      color: '#78909c',
    },
  ];

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (!sym || newShares <= 0 || newPrice <= 0) return;

    const cost = newShares * newPrice;
    if (cost > cash) {
      alert('Capital disponible insuficiente.');
      return;
    }

    const newMarketValue = cost;
    const existingIndex = positions.findIndex((p) => p.symbol === sym);

    if (existingIndex >= 0) {
      const existing = positions[existingIndex];
      const totalShares = existing.shares + newShares;
      const totalCost = existing.shares * existing.avgPrice + cost;
      const avgPrice = totalCost / totalShares;
      const marketValue = totalShares * newPrice;
      const unrealizedPl = marketValue - totalCost;
      const unrealizedPlPct = totalCost > 0 ? unrealizedPl / totalCost : 0;

      const updated = [...positions];
      updated[existingIndex] = {
        ...existing,
        shares: totalShares,
        avgPrice,
        currentPrice: newPrice,
        marketValue,
        unrealizedPl,
        unrealizedPlPct,
      };
      setPositions(updated);
    } else {
      const newPos: Position = {
        symbol: sym,
        name: `${sym} Asset`,
        shares: newShares,
        avgPrice: newPrice,
        currentPrice: newPrice,
        marketValue: newMarketValue,
        unrealizedPl: 0,
        unrealizedPlPct: 0,
        allocationPct: newMarketValue / totalValue,
      };
      setPositions([...positions, newPos]);
    }

    setCash((prev) => prev - cost);

    // Record order
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setOrders([
      {
        id: Date.now().toString(),
        timestamp: now,
        type: 'BUY',
        symbol: sym,
        shares: newShares,
        price: newPrice,
        totalAmount: cost,
      },
      ...orders,
    ]);

    setNewShares(10);
  };

  const handleClosePosition = (sym: string) => {
    const pos = positions.find((p) => p.symbol === sym);
    if (!pos) return;

    setCash((prev) => prev + pos.marketValue);
    setPositions(positions.filter((p) => p.symbol !== sym));

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setOrders([
      {
        id: Date.now().toString(),
        timestamp: now,
        type: 'SELL',
        symbol: sym,
        shares: pos.shares,
        price: pos.currentPrice,
        totalAmount: pos.marketValue,
      },
      ...orders,
    ]);
  };

  const handleDepositCash = () => {
    if (cashDelta <= 0) return;
    setCash((prev) => prev + cashDelta);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setOrders([
      {
        id: Date.now().toString(),
        timestamp: now,
        type: 'DEPOSIT',
        symbol: 'CASH',
        totalAmount: cashDelta,
      },
      ...orders,
    ]);
  };

  const handleWithdrawCash = () => {
    if (cashDelta <= 0 || cashDelta > cash) {
      alert('Monto inválido o superior al disponible.');
      return;
    }
    setCash((prev) => prev - cashDelta);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setOrders([
      {
        id: Date.now().toString(),
        timestamp: now,
        type: 'WITHDRAW',
        symbol: 'CASH',
        totalAmount: cashDelta,
      },
      ...orders,
    ]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Gestión de Portafolio 💼</h2>
          <p style={styles.subtitle}>
            Monitoreo de rendimiento, gráficos de asignación de activos y registro operacional
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={styles.kpiGrid}>
        <StatCard
          label="Valor Total del Portafolio"
          value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="var(--accent)"
          icon="🏦"
        />
        <StatCard
          label="Caja Disponible"
          value={`$${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="#2196f3"
          icon="💵"
        />
        <StatCard
          label="P&L No Realizado"
          value={`+$${totalUnrealizedPl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={`+${(totalReturnPct * 100).toFixed(2)}%`}
          changeType="positive"
          color="#4caf50"
          icon="📈"
        />
        <StatCard
          label="Mejor Activo"
          value={topPerformer ? topPerformer.symbol : 'N/A'}
          change={topPerformer ? `+${(topPerformer.unrealizedPlPct * 100).toFixed(2)}%` : '-'}
          changeType="positive"
          color="#4caf50"
          icon="🏆"
        />
      </div>

      {/* Main Grid: Allocation Donut & Quick Cash Manager */}
      <div style={styles.twoColumnGrid}>
        {/* Asset Allocation Donut Chart */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Asignación de Activos (Asset Allocation) 📊</h3>
          </div>
          <DonutChart
            data={pieData}
            centerText={`$${(totalValue / 1000).toFixed(1)}k`}
            centerSubtext="Total Portafolio"
          />
        </div>

        {/* Deposit / Withdraw Cash & Quick Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Gestor de Liquidez 💵</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 14px' }}>
              Simula depósitos o retiros de fondos en tu cuenta.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                value={cashDelta}
                onChange={(e) => setCashDelta(Number(e.target.value))}
                style={{ ...styles.formInput, flex: 1 }}
                placeholder="Monto USD"
              />
              <button onClick={handleDepositCash} style={styles.depositBtn}>
                + Depositar
              </button>
              <button onClick={handleWithdrawCash} style={styles.withdrawBtn}>
                - Retirar
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Resumen de Diversificación 🛡️</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <div style={styles.metricRow}>
                <span>Ratio de Inversión / Caja:</span>
                <strong>
                  {((totalInvested / totalValue) * 100).toFixed(1)}% Invertido / {((cash / totalValue) * 100).toFixed(1)}% Caja
                </strong>
              </div>
              <div style={styles.metricRow}>
                <span>Activo de Mayor Peso:</span>
                <strong>
                  {topPerformer ? `${topPerformer.symbol} (${((topPerformer.marketValue / totalValue) * 100).toFixed(1)}%)` : 'N/A'}
                </strong>
              </div>
              <div style={styles.metricRow}>
                <span>Mayor Rezagado (Worst P&L):</span>
                <strong style={{ color: worstPerformer && worstPerformer.unrealizedPlPct < 0 ? '#f44336' : 'var(--text-primary)' }}>
                  {worstPerformer ? `${worstPerformer.symbol} (${(worstPerformer.unrealizedPlPct * 100).toFixed(2)}%)` : 'N/A'}
                </strong>
              </div>
              <div style={styles.metricRow}>
                <span>Perfil de Riesgo Estimado:</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: '#e3f2fd',
                    color: '#1565c0',
                  }}
                >
                  MODERADO ALCISTA
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Posiciones Abiertas</h3>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Capital Invertido: ${totalInvested.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Símbolo</th>
                <th style={styles.th}>Cantidad</th>
                <th style={styles.th}>Precio Entrada</th>
                <th style={styles.th}>Precio Actual</th>
                <th style={styles.th}>Valor Mercado</th>
                <th style={styles.th}>P&L ($)</th>
                <th style={styles.th}>P&L (%)</th>
                <th style={styles.th}>Peso (%)</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{p.symbol}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.name}</div>
                  </td>
                  <td style={styles.td}>{p.shares}</td>
                  <td style={styles.td}>${p.avgPrice.toFixed(2)}</td>
                  <td style={styles.td}>${p.currentPrice.toFixed(2)}</td>
                  <td style={styles.td}>${p.marketValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td style={{ ...styles.td, color: p.unrealizedPl >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                    {p.unrealizedPl >= 0 ? '+' : ''}${p.unrealizedPl.toFixed(2)}
                  </td>
                  <td style={{ ...styles.td, color: p.unrealizedPlPct >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                    {(p.unrealizedPlPct * 100).toFixed(2)}%
                  </td>
                  <td style={styles.td}>
                    <div style={styles.allocBarContainer}>
                      <div
                        style={{
                          ...styles.allocBarFill,
                          width: `${Math.min(100, (p.marketValue / totalValue) * 100)}%`,
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        {((p.marketValue / totalValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleClosePosition(p.symbol)}
                      style={styles.closeBtn}
                      title="Cerrar posición y enviar capital a caja"
                    >
                      Cerrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Position Simulator & Order Log Grid */}
      <div style={styles.twoColumnGrid}>
        {/* Order Form */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Simulador de Nueva Orden ➕</h3>
          <form onSubmit={handleAddPosition} style={styles.orderForm}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Símbolo</label>
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                style={styles.formInput}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Cantidad (Shares)</label>
              <input
                type="number"
                step="any"
                value={newShares}
                onChange={(e) => setNewShares(Number(e.target.value))}
                style={styles.formInput}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Precio Límite ($)</label>
              <input
                type="number"
                step="any"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                style={styles.formInput}
                required
              />
            </div>
            <button type="submit" style={styles.submitOrderBtn}>
              + Ejecutar Compra
            </button>
          </form>
        </div>

        {/* Recent Activity Log */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Registro de Transacciones 📜</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '180px', overflowY: 'auto' }}>
            {orders.map((ord) => (
              <div key={ord.id} style={styles.orderLogItem}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor:
                      ord.type === 'BUY'
                        ? '#e8f5e9'
                        : ord.type === 'SELL'
                        ? '#ffebee'
                        : ord.type === 'DEPOSIT'
                        ? '#e3f2fd'
                        : '#fff3e0',
                    color:
                      ord.type === 'BUY'
                        ? '#2e7d32'
                        : ord.type === 'SELL'
                        ? '#c62828'
                        : ord.type === 'DEPOSIT'
                        ? '#1565c0'
                        : '#e65100',
                  }}
                >
                  {ord.type}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ord.symbol}</span>
                {ord.shares && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {ord.shares} @ ${ord.price?.toFixed(2)}
                  </span>
                )}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', marginLeft: 'auto' }}>
                  ${ord.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: 1150,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
    fontSize: '0.875rem',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 12px',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
  },
  allocBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '110px',
  },
  allocBarFill: {
    height: '6px',
    backgroundColor: 'var(--accent)',
    borderRadius: '3px',
  },
  closeBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: '1px solid #f44336',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  depositBtn: {
    padding: '8px 14px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  withdrawBtn: {
    padding: '8px 14px',
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  orderForm: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    minWidth: '120px',
  },
  formLabel: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  formInput: {
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  submitOrderBtn: {
    padding: '10px 16px',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    height: '38px',
  },
  orderLogItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
};
