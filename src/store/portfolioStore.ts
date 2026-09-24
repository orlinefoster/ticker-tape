import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PortfolioType = 'cash' | 'iol' | 'binance';

export interface CashHolding {
  id: string;
  currency: 'ARS' | 'USD' | 'EUR';
  amount: number;
  institution: string; // e.g. "Banco Santander", "Efectivo Billete", "Caución BYMA"
  yieldRateAnnual?: number; // e.g. 34.5% annual rate if placed
  notes?: string;
}

export interface IOLHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: 'CEDEAR' | 'ACCION_LOCAL' | 'BONO_SOBERANO' | 'ON_CORPORATIVA' | 'FCI_CAUCION';
  nominalQuantity: number;
  avgBuyPriceArs: number;
  currentPriceArs: number;
  cedearRatio?: string;
  currencyExposure: 'USD_CCL' | 'USD_MEP' | 'ARS';
}

export interface BinanceHolding {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyPriceUsdt: number;
  currentPriceUsdt: number;
  network?: string;
}

export interface UnifiedTransaction {
  id: string;
  timestamp: string;
  portfolioType: PortfolioType;
  type: 'COMPRA' | 'VENTA' | 'DEPOSITO' | 'EXTRACCION' | 'DIVIDENDO' | 'INTERES';
  symbol?: string;
  quantity?: number;
  price?: number;
  currency: 'ARS' | 'USD' | 'USDT';
  totalNominal: number;
  commission?: number;
  notes?: string;
}

export interface EquitySnapshot {
  date: string;
  totalUsd: number;
  totalArs: number;
  cashUsd: number;
  iolUsd: number;
  binanceUsd: number;
  cclRate: number;
}

export interface OperationalAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  portfolioType: PortfolioType | 'general';
  title: string;
  detail: string;
  actionRoute?: string;
  actionLabel?: string;
  createdAt: string;
}

interface MarketRates {
  ccl: number;
  mep: number;
  oficial: number;
}

interface PortfolioState {
  // Exchange Rates
  rates: MarketRates;
  setRates: (rates: Partial<MarketRates>) => void;

  // Portfolios
  cashHoldings: CashHolding[];
  iolHoldings: IOLHolding[];
  binanceHoldings: BinanceHolding[];
  transactions: UnifiedTransaction[];
  equityHistory: EquitySnapshot[];
  alerts: OperationalAlert[];

  // Mutators: Cash
  addCashHolding: (holding: Omit<CashHolding, 'id'>) => void;
  removeCashHolding: (id: string) => void;
  updateCashHolding: (id: string, updates: Partial<CashHolding>) => void;

  // Mutators: IOL
  addIOLHolding: (holding: Omit<IOLHolding, 'id'>) => void;
  removeIOLHolding: (id: string) => void;
  updateIOLHolding: (id: string, updates: Partial<IOLHolding>) => void;

  // Mutators: Binance
  addBinanceHolding: (holding: Omit<BinanceHolding, 'id'>) => void;
  removeBinanceHolding: (id: string) => void;
  updateBinanceHolding: (id: string, updates: Partial<BinanceHolding>) => void;

  // Mutators: Transactions
  addTransaction: (tx: Omit<UnifiedTransaction, 'id' | 'timestamp'>) => void;

  // Mutators: Alerts
  dismissAlert: (id: string) => void;
  addAlert: (alert: Omit<OperationalAlert, 'id' | 'createdAt'>) => void;

  // Computed totals helpers
  getCashValuationUsd: () => number;
  getIOLValuationUsd: () => number;
  getBinanceValuationUsd: () => number;
  getTotalNetWorthUsd: () => number;
}

const DEFAULT_RATES: MarketRates = {
  ccl: 1320,
  mep: 1295,
  oficial: 1080,
};

const INITIAL_CASH: CashHolding[] = [
  { id: 'c1', currency: 'USD', amount: 8500, institution: 'Caja Fuerte / Ahorro Físico' },
  { id: 'c2', currency: 'ARS', amount: 4850000, institution: 'Caución Bursátil 1D (BYMA)', yieldRateAnnual: 34.5 },
  { id: 'c3', currency: 'ARS', amount: 1200000, institution: 'Cuenta Operativa Galicia', yieldRateAnnual: 0 },
  { id: 'c4', currency: 'USD', amount: 2400, institution: 'Cuenta Ahorro USD Banco', yieldRateAnnual: 1.5 },
];

const INITIAL_IOL: IOLHolding[] = [
  {
    id: 'iol1',
    symbol: 'SPY',
    name: 'CEDEAR S&P 500 (SPDR)',
    assetType: 'CEDEAR',
    nominalQuantity: 180,
    avgBuyPriceArs: 29500.0,
    currentPriceArs: 33400.0,
    cedearRatio: '20:1',
    currencyExposure: 'USD_CCL',
  },
  {
    id: 'iol2',
    symbol: 'AAPL',
    name: 'CEDEAR Apple Inc.',
    assetType: 'CEDEAR',
    nominalQuantity: 240,
    avgBuyPriceArs: 18200.0,
    currentPriceArs: 20100.0,
    cedearRatio: '10:1',
    currencyExposure: 'USD_CCL',
  },
  {
    id: 'iol3',
    symbol: 'GGAL',
    name: 'Grupo Financiero Galicia',
    assetType: 'ACCION_LOCAL',
    nominalQuantity: 1200,
    avgBuyPriceArs: 4100.0,
    currentPriceArs: 4750.0,
    currencyExposure: 'ARS',
  },
  {
    id: 'iol4',
    symbol: 'GD30',
    name: 'Bono Soberano Global 2030',
    assetType: 'BONO_SOBERANO',
    nominalQuantity: 5000,
    avgBuyPriceArs: 740.0,
    currentPriceArs: 835.0,
    currencyExposure: 'USD_MEP',
  },
  {
    id: 'iol5',
    symbol: 'YMCHO',
    name: 'ON YPF Clase 2026',
    assetType: 'ON_CORPORATIVA',
    nominalQuantity: 2000,
    avgBuyPriceArs: 1260.0,
    currentPriceArs: 1320.0,
    currencyExposure: 'USD_MEP',
  },
];

const INITIAL_BINANCE: BinanceHolding[] = [
  {
    id: 'bin1',
    symbol: 'BTC',
    name: 'Bitcoin Spot',
    amount: 0.42,
    avgBuyPriceUsdt: 61500.0,
    currentPriceUsdt: 67250.0,
    network: 'Bitcoin Core',
  },
  {
    id: 'bin2',
    symbol: 'ETH',
    name: 'Ethereum Spot',
    amount: 3.5,
    avgBuyPriceUsdt: 2850.0,
    currentPriceUsdt: 3180.0,
    network: 'Ethereum Mainnet',
  },
  {
    id: 'bin3',
    symbol: 'SOL',
    name: 'Solana Spot',
    amount: 45.0,
    avgBuyPriceUsdt: 142.0,
    currentPriceUsdt: 186.5,
    network: 'Solana',
  },
  {
    id: 'bin4',
    symbol: 'USDT',
    name: 'Tether Stablecoin (Cash Cripto)',
    amount: 5400.0,
    avgBuyPriceUsdt: 1.0,
    currentPriceUsdt: 1.0,
    network: 'TRC-20 / Arbitrum',
  },
];

const INITIAL_EQUITY_HISTORY: EquitySnapshot[] = [
  { date: '2026-05-01', totalUsd: 68400, totalArs: 82080000, cashUsd: 14500, iolUsd: 22100, binanceUsd: 31800, cclRate: 1200 },
  { date: '2026-06-01', totalUsd: 71200, totalArs: 88288000, cashUsd: 15200, iolUsd: 23400, binanceUsd: 32600, cclRate: 1240 },
  { date: '2026-07-01', totalUsd: 73900, totalArs: 94592000, cashUsd: 14800, iolUsd: 24800, binanceUsd: 34300, cclRate: 1280 },
  { date: '2026-08-01', totalUsd: 78500, totalArs: 102050000, cashUsd: 15400, iolUsd: 26200, binanceUsd: 36900, cclRate: 1300 },
  { date: '2026-09-01', totalUsd: 83200, totalArs: 109824000, cashUsd: 15100, iolUsd: 27900, binanceUsd: 40200, cclRate: 1320 },
  { date: '2026-09-23', totalUsd: 88450, totalArs: 116754000, cashUsd: 15480, iolUsd: 29870, binanceUsd: 43100, cclRate: 1320 },
];

const INITIAL_ALERTS: OperationalAlert[] = [
  {
    id: 'alt-1',
    severity: 'warning',
    portfolioType: 'binance',
    title: '3 transacciones de Binance pendientes de conciliar',
    detail: 'Se detectaron depósitos o trades recientes sin categorizar en el libro contable de cripto.',
    actionRoute: '/portfolio',
    actionLabel: 'Conciliar en Binance',
    createdAt: '2026-09-23T08:00:00Z',
  },
  {
    id: 'alt-2',
    severity: 'info',
    portfolioType: 'iol',
    title: 'MCP InvertirOnline disponible para conexión directa',
    detail: 'Servidor oficial mcp.invertironline.com listo para sincronizar operaciones y cotizaciones de BYMA.',
    actionRoute: '/providers',
    actionLabel: 'Configurar IOL MCP',
    createdAt: '2026-09-23T08:30:00Z',
  },
  {
    id: 'alt-3',
    severity: 'info',
    portfolioType: 'cash',
    title: 'Vencimiento de Caución Bursátil',
    detail: 'La caución de $4.850.000 ARS vence hoy a las 15:00 hs. Revisar tasa de renovación en BYMA.',
    actionRoute: '/portfolio',
    actionLabel: 'Ver Liquidez',
    createdAt: '2026-09-23T09:15:00Z',
  },
];

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      rates: DEFAULT_RATES,
      setRates: (newRates) =>
        set((state) => ({ rates: { ...state.rates, ...newRates } })),

      cashHoldings: INITIAL_CASH,
      iolHoldings: INITIAL_IOL,
      binanceHoldings: INITIAL_BINANCE,
      transactions: [],
      equityHistory: INITIAL_EQUITY_HISTORY,
      alerts: INITIAL_ALERTS,

      addCashHolding: (holding) =>
        set((state) => ({
          cashHoldings: [...state.cashHoldings, { ...holding, id: `cash-${Date.now()}` }],
        })),
      removeCashHolding: (id) =>
        set((state) => ({
          cashHoldings: state.cashHoldings.filter((h) => h.id !== id),
        })),
      updateCashHolding: (id, updates) =>
        set((state) => ({
          cashHoldings: state.cashHoldings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      addIOLHolding: (holding) =>
        set((state) => ({
          iolHoldings: [...state.iolHoldings, { ...holding, id: `iol-${Date.now()}` }],
        })),
      removeIOLHolding: (id) =>
        set((state) => ({
          iolHoldings: state.iolHoldings.filter((h) => h.id !== id),
        })),
      updateIOLHolding: (id, updates) =>
        set((state) => ({
          iolHoldings: state.iolHoldings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      addBinanceHolding: (holding) =>
        set((state) => ({
          binanceHoldings: [...state.binanceHoldings, { ...holding, id: `bin-${Date.now()}` }],
        })),
      removeBinanceHolding: (id) =>
        set((state) => ({
          binanceHoldings: state.binanceHoldings.filter((h) => h.id !== id),
        })),
      updateBinanceHolding: (id, updates) =>
        set((state) => ({
          binanceHoldings: state.binanceHoldings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [
            {
              ...tx,
              id: `tx-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
            ...state.transactions,
          ],
        })),

      dismissAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),
      addAlert: (alert) =>
        set((state) => ({
          alerts: [
            {
              ...alert,
              id: `alt-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
            ...state.alerts,
          ],
        })),

      getCashValuationUsd: () => {
        const { cashHoldings, rates } = get();
        return cashHoldings.reduce((sum, h) => {
          if (h.currency === 'USD') return sum + h.amount;
          if (h.currency === 'ARS') return sum + h.amount / (rates.ccl || 1320);
          if (h.currency === 'EUR') return sum + h.amount * 1.08;
          return sum;
        }, 0);
      },

      getIOLValuationUsd: () => {
        const { iolHoldings, rates } = get();
        const totalArs = iolHoldings.reduce((sum, h) => sum + h.nominalQuantity * h.currentPriceArs, 0);
        return totalArs / (rates.ccl || 1320);
      },

      getBinanceValuationUsd: () => {
        const { binanceHoldings } = get();
        return binanceHoldings.reduce((sum, h) => sum + h.amount * h.currentPriceUsdt, 0);
      },

      getTotalNetWorthUsd: () => {
        return get().getCashValuationUsd() + get().getIOLValuationUsd() + get().getBinanceValuationUsd();
      },
    }),
    {
      name: 'ticker-tape-portfolio-v1',
      partialize: (state) => ({
        rates: state.rates,
        cashHoldings: state.cashHoldings,
        iolHoldings: state.iolHoldings,
        binanceHoldings: state.binanceHoldings,
        transactions: state.transactions,
      }),
    }
  )
);
