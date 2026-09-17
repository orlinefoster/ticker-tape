import type { UniversePreset } from './types';

export const UNIVERSE_PRESETS: UniversePreset[] = [
  {
    id: 'crypto',
    label: '⚡ Crypto Alpha Rotation',
    description: 'Ecosistema cripto comparado contra el benchmark Bitcoin (BTC)',
    benchmark: 'BTC',
    symbols: ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'LINK', 'RENDER', 'NEAR', 'SUI', 'ADA'],
  },
  {
    id: 'sectors',
    label: '🏢 Sectores S&P 500',
    description: '11 Sectores clave de EE.UU. contrastados con el índice rector S&P 500 (SPY)',
    benchmark: 'SPY',
    symbols: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY', 'XLB', 'XLC', 'XLRE'],
  },
  {
    id: 'megacap',
    label: '🚀 MegaCap Leaders & Tech',
    description: 'Gigantes tecnológicos y de crecimiento vs S&P 500 (SPY)',
    benchmark: 'SPY',
    symbols: ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'AVGO', 'NFLX'],
  },
  {
    id: 'global',
    label: '🌐 Macro Global Multi-Activos',
    description: 'Acciones, Bonos, Oro, Commodities y Bitcoin vs Renta Variable Global',
    benchmark: 'SPY',
    symbols: ['SPY', 'QQQ', 'IWM', 'EEM', 'TLT', 'GLD', 'DBC', 'BTC'],
  },
  {
    id: 'cedears',
    label: '🇦🇷 CEDEARs & ADRs Líderes',
    description: 'Activos populares y de alta liquidez para inversores latinoamericanos',
    benchmark: 'SPY',
    symbols: ['MELI', 'GGAL', 'YPF', 'VIST', 'PAMP', 'BMA', 'TS', 'GLOB', 'CEPU'],
  },
  {
    id: 'custom',
    label: '⚙️ Lista Personalizada',
    description: 'Configura tus propios símbolos y benchmark a analizar',
    benchmark: 'SPY',
    symbols: ['SPY', 'QQQ', 'NVDA', 'TLT', 'GLD'],
  },
];
