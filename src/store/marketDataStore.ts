import { create } from 'zustand';
import { commands, type OHLCVBar } from '@/lib/tauri';

export interface MarketDataState {
  cache: Record<string, OHLCVBar[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;

  fetchData: (symbol: string, range: string) => Promise<void>;
  getData: (symbol: string) => OHLCVBar[] | null;
  clearCache: () => void;
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  fetchData: async (symbol: string, range: string) => {
    const key = symbol;
    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: '' },
    }));

    try {
      const data = await commands.fetchMarketData(symbol, range);
      set((state) => ({
        cache: { ...state.cache, [key]: data },
        loading: { ...state.loading, [key]: false },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [key]: message },
        loading: { ...state.loading, [key]: false },
      }));
    }
  },

  getData: (symbol: string) => {
    const data = get().cache[symbol];
    return data ?? null;
  },

  clearCache: () => set({ cache: {}, loading: {}, errors: {} }),
}));
