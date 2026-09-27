import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBinanceConfig,
  saveBinanceConfig,
  clearBinanceConfig,
  getIOLConfig,
  saveIOLConfig,
  clearIOLConfig,
  testBinanceConnection,
  testIOLConnection,
} from './providerConfigs';

describe('providerConfigs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and saves Binance configuration', () => {
    expect(getBinanceConfig()).toEqual({ apiKey: '', secretKey: '', isTestnet: false });

    saveBinanceConfig({ apiKey: 'test-api-key', secretKey: 'test-secret', isTestnet: true });
    expect(getBinanceConfig()).toEqual({
      apiKey: 'test-api-key',
      secretKey: 'test-secret',
      isTestnet: true,
    });

    clearBinanceConfig();
    expect(getBinanceConfig()).toEqual({ apiKey: '', secretKey: '', isTestnet: false });
  });

  it('reads and saves IOL MCP configuration', () => {
    expect(getIOLConfig()).toEqual({
      endpoint: 'https://mcp.invertironline.com/',
      token: '',
      username: '',
    });

    saveIOLConfig({
      endpoint: 'http://localhost:8080/sse',
      token: 'jwt-bearer-token',
      username: 'usuario_iol',
    });

    expect(getIOLConfig()).toEqual({
      endpoint: 'http://localhost:8080/sse',
      token: 'jwt-bearer-token',
      username: 'usuario_iol',
    });

    clearIOLConfig();
    expect(getIOLConfig()).toEqual({
      endpoint: 'https://mcp.invertironline.com/',
      token: '',
      username: '',
    });
  });

  it('tests Binance connection successfully when fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ serverTime: 1727280000000 }),
      })
    );

    const res = await testBinanceConnection({
      apiKey: 'valid-key-longer-than-10',
      secretKey: 'secret',
      isTestnet: false,
    });

    expect(res.online).toBe(true);
    expect(res.message).toContain('Conectado a Binance Spot');
    expect(res.serverTime).toBe(1727280000000);
  });

  it('tests IOL connection and returns MCP tools', async () => {
    const res = await testIOLConnection();
    expect(res.online).toBe(true);
    expect(res.tools).toContain('iol_get_cuenta');
    expect(res.tools).toContain('iol_get_portafolio');
  });
});
