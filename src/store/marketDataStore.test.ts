import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketDataStore } from './marketDataStore';

describe('useMarketDataStore', () => {
  beforeEach(() => {
    useMarketDataStore.getState().clearCache();
  });

  it('should initialize empty cache', () => {
    const state = useMarketDataStore.getState();
    expect(state.cache).toEqual({});
    expect(state.getData('SPY')).toBeNull();
  });

  it('should clear cache properly', () => {
    useMarketDataStore.setState({
      cache: {
        SPY: [
          { symbol: 'SPY', date: '2026-01-01', open: 500, high: 505, low: 498, close: 502, volume: 1000 },
        ],
      },
    });

    expect(useMarketDataStore.getState().getData('SPY')).toHaveLength(1);
    useMarketDataStore.getState().clearCache();
    expect(useMarketDataStore.getState().getData('SPY')).toBeNull();
  });
});
