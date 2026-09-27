import type { OHLCVBar } from '@/lib/tauri';
import {
  buildEquityCurvePoints,
  equityPointsToOHLCVBars,
  generateSyntheticBarsForSymbol,
} from './equityEngine';

export interface SyntheticSymbolInfo {
  symbol: string;
  name: string;
  category: 'Cartera Total' | 'Composito' | 'Posición' | 'Trade';
  icon: string;
  description: string;
}

export const SYNTHETIC_SYMBOLS: SyntheticSymbolInfo[] = [
  {
    symbol: 'PORTFOLIO:TOTAL',
    name: 'Cartera Total Consolidada',
    category: 'Cartera Total',
    icon: '💼',
    description: 'Valuación total acumulada de la cartera en tiempo real (Equidad global).',
  },
  {
    symbol: 'PORTFOLIO:LONGS',
    name: 'Cartera Sub-curva Longs (Compras)',
    category: 'Cartera Total',
    icon: '🟢',
    description: 'Curva de capital generada exclusivamente por operaciones de compra.',
  },
  {
    symbol: 'PORTFOLIO:SHORTS',
    name: 'Cartera Sub-curva Shorts (Ventas)',
    category: 'Cartera Total',
    icon: '🔴',
    description: 'Curva de capital generada exclusivamente por operaciones de venta/cobertura.',
  },
  {
    symbol: 'COMP:CRYPTO',
    name: 'Composito Criptoactivos (Spot)',
    category: 'Composito',
    icon: '⚡',
    description: 'Porción valorizada de la cartera concentrada en el cluster de criptomonedas.',
  },
  {
    symbol: 'COMP:DEFENSIVE',
    name: 'Composito Defensivo (Cash + Yield)',
    category: 'Composito',
    icon: '🛡️',
    description: 'Porción de liquidez USDT y activos de bajo beta.',
  },
  {
    symbol: 'POS:BTC',
    name: 'Posición Individual: Bitcoin (0.45 BTC)',
    category: 'Posición',
    icon: '₿',
    description: 'Evolución valorizada y PnL de la posición en Bitcoin.',
  },
  {
    symbol: 'POS:ETH',
    name: 'Posición Individual: Ethereum (3.8 ETH)',
    category: 'Posición',
    icon: 'Ξ',
    description: 'Evolución valorizada y PnL de la posición en Ethereum.',
  },
  {
    symbol: 'POS:SOL',
    name: 'Posición Individual: Solana (35 SOL)',
    category: 'Posición',
    icon: '◎',
    description: 'Evolución valorizada y PnL de la posición en Solana.',
  },
  {
    symbol: 'TRADE:tx-101',
    name: 'Trade Stand-alone #tx-101 (BTC Buy)',
    category: 'Trade',
    icon: '🏷️',
    description: 'Rendimiento individual del trade de compra de BTC a 61,000 USDT.',
  },
];

/**
 * Generates synthetic mock/live history bars for the requested symbol.
 */
export function getSyntheticBars(symbol: string, currentTotalValue = 57263.5): OHLCVBar[] {
  const days = 60;
  const rawPoints = [];
  let running = currentTotalValue * 0.85;
  let cash = 4850;

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Seeded realistic market return
    const dailyReturn = Math.sin(i * 0.5) * 0.012 + Math.cos(i * 0.3) * 0.008 + 0.0035;
    running = running * (1 + dailyReturn);

    rawPoints.push({
      date: dateStr,
      equity: Math.round(running),
      cash,
      invested: Math.round(running - cash),
      unrealizedPnL: Math.round(running - currentTotalValue * 0.85),
      realizedPnLCumulative: 1450,
    });
  }

  // Anchor last point
  if (rawPoints.length > 0) {
    rawPoints[rawPoints.length - 1].equity = Math.round(currentTotalValue);
  }

  const { points } = buildEquityCurvePoints(rawPoints);
  const baseBars = equityPointsToOHLCVBars(points);

  switch (symbol) {
    case 'PORTFOLIO:TOTAL':
      return baseBars;
    case 'PORTFOLIO:LONGS':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.82);
    case 'PORTFOLIO:SHORTS':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.18);
    case 'COMP:CRYPTO':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.91);
    case 'COMP:DEFENSIVE':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.09);
    case 'POS:BTC':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.528);
    case 'POS:ETH':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.207);
    case 'POS:SOL':
      return generateSyntheticBarsForSymbol(symbol, baseBars, 0.094);
    case 'TRADE:tx-101':
      return generateSyntheticBarsForSymbol(symbol, baseBars.slice(-30), 0.21);
    default:
      return baseBars;
  }
}

export function isSyntheticSymbol(symbol: string): boolean {
  return (
    symbol.startsWith('PORTFOLIO:') ||
    symbol.startsWith('COMP:') ||
    symbol.startsWith('POS:') ||
    symbol.startsWith('TRADE:')
  );
}
