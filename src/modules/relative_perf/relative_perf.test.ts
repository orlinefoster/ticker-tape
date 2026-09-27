import { describe, it, expect } from 'vitest';
import { MARKET_PRESETS } from './index';

describe('Relative Performance Module & Presets', () => {
  it('defines valid TradFi preset with SPY benchmark', () => {
    const tradfi = MARKET_PRESETS.tradfi;
    expect(tradfi.benchmark).toBe('SPY');
    expect(tradfi.symbols).toContain('SPY');
    expect(tradfi.symbols).toContain('QQQ');
    expect(tradfi.symbols.length).toBeGreaterThanOrEqual(5);
  });

  it('defines valid Crypto preset with BTC benchmark', () => {
    const crypto = MARKET_PRESETS.crypto;
    expect(crypto.benchmark).toBe('BTC');
    expect(crypto.symbols).toContain('BTC');
    expect(crypto.symbols).toContain('ETH');
    expect(crypto.symbols).toContain('SOL');
    expect(crypto.symbols.length).toBeGreaterThanOrEqual(6);
  });

  it('defines flexible Custom preset', () => {
    const custom = MARKET_PRESETS.custom;
    expect(custom.id).toBe('custom');
    expect(custom.benchmark).toBeDefined();
    expect(custom.symbols.length).toBeGreaterThan(0);
  });
});

describe('RS Heatmap Color Mapping', () => {
  it('returns transparent for zero or NaN values', async () => {
    const { getReturnHeatmapColor } = await import('./components/RSHeatmapMatrix');
    const zeroRes = getReturnHeatmapColor(0);
    expect(zeroRes.bg).toBe('transparent');

    const nanRes = getReturnHeatmapColor(NaN);
    expect(nanRes.bg).toBe('transparent');
  });

  it('maps positive returns to green spectrum with alpha', async () => {
    const { getReturnHeatmapColor } = await import('./components/RSHeatmapMatrix');
    const res = getReturnHeatmapColor(0.20);
    expect(res.bg).toContain('16, 185, 129');
    expect(res.text).toBeDefined();
  });

  it('maps negative returns to red spectrum with alpha', async () => {
    const { getReturnHeatmapColor } = await import('./components/RSHeatmapMatrix');
    const res = getReturnHeatmapColor(-0.15);
    expect(res.bg).toContain('239, 68, 68');
    expect(res.text).toBeDefined();
  });
});
