export type SectorCategory = 'core' | 'satellite';

export interface SectorAsset {
  symbol: string;
  name: string;
  category: SectorCategory;
  targetWeightPct: number; // 0 - 100
  currentQuantity: number;
  currentPriceUsd: number;
  currentPriceArs: number;
  cedearRatio?: string;
  description: string;
}

export interface DcaPlanConfig {
  monthlyDeposit: number;
  currency: 'USD' | 'ARS';
  driftTolerancePct: number; // e.g. 2.5%
  expectedAnnualReturnPct: number; // e.g. 9.5%
  cclRate: number; // e.g. 1320
}

export interface SuggestedOrder {
  symbol: string;
  name: string;
  category: SectorCategory;
  currentQuantity: number;
  sharesToBuy: number;
  orderCost: number; // in plan currency
  currentWeightPct: number;
  targetWeightPct: number;
  projectedWeightPct: number;
  driftPct: number; // currentWeightPct - targetWeightPct
  status: 'underweight' | 'balanced' | 'overweight';
}

export interface DcaCalculationResult {
  totalCurrentValue: number;
  monthlyDeposit: number;
  totalProjectedValue: number;
  suggestedOrders: SuggestedOrder[];
  allocatedAmount: number;
  remainingCash: number;
  currency: 'USD' | 'ARS';
}

export interface ContributionRecord {
  id: string;
  date: string;
  amount: number;
  currency: 'USD' | 'ARS';
  cclRate: number;
  orders: {
    symbol: string;
    quantity: number;
    price: number;
  }[];
  notes?: string;
}

export interface WealthProjectionPoint {
  month: number;
  year: number;
  totalContributions: number;
  projectedPortfolioValue: number;
  compoundGains: number;
}

export const DEFAULT_SECTOR_UNIVERSE: SectorAsset[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500 Core Index',
    category: 'core',
    targetWeightPct: 55,
    currentQuantity: 0,
    currentPriceUsd: 590.0,
    currentPriceArs: 39000.0,
    cedearRatio: '20:1',
    description: 'Núcleo del portafolio (500 mayores empresas de EE.UU.)',
  },
  {
    symbol: 'XLK',
    name: 'Technology Select Sector',
    category: 'satellite',
    targetWeightPct: 15,
    currentQuantity: 0,
    currentPriceUsd: 228.0,
    currentPriceArs: 30100.0,
    cedearRatio: '10:1',
    description: 'Hardware, software, semiconductores y cloud computing',
  },
  {
    symbol: 'XLF',
    name: 'Financial Select Sector',
    category: 'satellite',
    targetWeightPct: 10,
    currentQuantity: 0,
    currentPriceUsd: 48.5,
    currentPriceArs: 16000.0,
    cedearRatio: '4:1',
    description: 'Bancos globales, aseguradoras y servicios financieros',
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector',
    category: 'satellite',
    targetWeightPct: 5,
    currentQuantity: 0,
    currentPriceUsd: 92.0,
    currentPriceArs: 20240.0,
    cedearRatio: '6:1',
    description: 'Petróleo, gas, refinamiento y servicios energéticos',
  },
  {
    symbol: 'XLV',
    name: 'Health Care Select Sector',
    category: 'satellite',
    targetWeightPct: 5,
    currentQuantity: 0,
    currentPriceUsd: 148.0,
    currentPriceArs: 19500.0,
    cedearRatio: '10:1',
    description: 'Farmacéuticas, biotecnología y equipamiento médico',
  },
  {
    symbol: 'XLI',
    name: 'Industrial Select Sector',
    category: 'satellite',
    targetWeightPct: 5,
    currentQuantity: 0,
    currentPriceUsd: 132.0,
    currentPriceArs: 17400.0,
    cedearRatio: '10:1',
    description: 'Aeroespacial, defensa, transporte y maquinaria',
  },
  {
    symbol: 'XLC',
    name: 'Communication Services',
    category: 'satellite',
    targetWeightPct: 5,
    currentQuantity: 0,
    currentPriceUsd: 94.0,
    currentPriceArs: 12400.0,
    cedearRatio: '10:1',
    description: 'Telecomunicaciones, medios digitales y entretenimiento',
  },
];
