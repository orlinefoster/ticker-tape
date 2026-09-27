/**
 * Provider & Integration Credentials Manager
 * Secure local storage for external services: Binance API, IOL MCP Broker, and Supabase.
 */

import { iolMcpClient } from './iolMcp';

export interface BinanceConfig {
  apiKey: string;
  secretKey: string;
  isTestnet: boolean;
}

export interface IOLConfig {
  endpoint: string;
  token: string;
  username?: string;
}

const BINANCE_API_KEY_STORAGE = 'TICKER_TAPE_BINANCE_API_KEY';
const BINANCE_SECRET_KEY_STORAGE = 'TICKER_TAPE_BINANCE_SECRET_KEY';
const BINANCE_TESTNET_STORAGE = 'TICKER_TAPE_BINANCE_TESTNET';

const IOL_ENDPOINT_STORAGE = 'TICKER_TAPE_IOL_MCP_ENDPOINT';
const IOL_TOKEN_STORAGE = 'TICKER_TAPE_IOL_TOKEN';
const IOL_USER_STORAGE = 'TICKER_TAPE_IOL_USERNAME';

// ---------------------------------------------------------------------------
// Binance API Helpers
// ---------------------------------------------------------------------------

export function getBinanceConfig(): BinanceConfig {
  if (typeof window === 'undefined') {
    return { apiKey: '', secretKey: '', isTestnet: false };
  }
  return {
    apiKey: localStorage.getItem(BINANCE_API_KEY_STORAGE) || '',
    secretKey: localStorage.getItem(BINANCE_SECRET_KEY_STORAGE) || '',
    isTestnet: localStorage.getItem(BINANCE_TESTNET_STORAGE) === 'true',
  };
}

export function saveBinanceConfig(config: Partial<BinanceConfig>): void {
  if (typeof window === 'undefined') return;
  if (config.apiKey !== undefined) {
    localStorage.setItem(BINANCE_API_KEY_STORAGE, config.apiKey.trim());
  }
  if (config.secretKey !== undefined) {
    localStorage.setItem(BINANCE_SECRET_KEY_STORAGE, config.secretKey.trim());
  }
  if (config.isTestnet !== undefined) {
    localStorage.setItem(BINANCE_TESTNET_STORAGE, String(config.isTestnet));
  }
}

export function clearBinanceConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BINANCE_API_KEY_STORAGE);
  localStorage.removeItem(BINANCE_SECRET_KEY_STORAGE);
  localStorage.removeItem(BINANCE_TESTNET_STORAGE);
}

export async function testBinanceConnection(config?: BinanceConfig): Promise<{
  online: boolean;
  latencyMs: number;
  message: string;
  serverTime?: number;
}> {
  const conf = config || getBinanceConfig();
  const baseUrl = conf.isTestnet
    ? 'https://testnet.binance.vision/api/v3'
    : 'https://api.binance.com/api/v3';

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${baseUrl}/time`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Math.round(performance.now() - start);
    if (!res.ok) {
      return {
        online: false,
        latencyMs: latency,
        message: `HTTP ${res.status}: Fallo en endpoint Binance (${baseUrl})`,
      };
    }

    const data = await res.json();
    const hasKey = Boolean(conf.apiKey && conf.apiKey.length > 10);

    return {
      online: true,
      latencyMs: latency,
      message: hasKey
        ? `✅ Conectado a Binance Spot (${conf.isTestnet ? 'Testnet' : 'Mainnet'}). API Key configurada.`
        : `⚡ Endpoint público de Binance activo (${latency} ms). Agregá tu API Key para operar en Modo Real.`,
      serverTime: data.serverTime,
    };
  } catch (err: unknown) {
    const latency = Math.round(performance.now() - start);
    return {
      online: false,
      latencyMs: latency,
      message: `Error de red con Binance: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// InvertirOnline (IOL) MCP Helpers
// ---------------------------------------------------------------------------

export function getIOLConfig(): IOLConfig {
  if (typeof window === 'undefined') {
    return { endpoint: 'https://mcp.invertironline.com/', token: '', username: '' };
  }
  return {
    endpoint: localStorage.getItem(IOL_ENDPOINT_STORAGE) || 'https://mcp.invertironline.com/',
    token: localStorage.getItem(IOL_TOKEN_STORAGE) || '',
    username: localStorage.getItem(IOL_USER_STORAGE) || '',
  };
}

export function saveIOLConfig(config: Partial<IOLConfig>): void {
  if (typeof window === 'undefined') return;
  if (config.endpoint !== undefined) {
    localStorage.setItem(IOL_ENDPOINT_STORAGE, config.endpoint.trim());
  }
  if (config.token !== undefined) {
    localStorage.setItem(IOL_TOKEN_STORAGE, config.token.trim());
    iolMcpClient.setToken(config.token.trim());
  }
  if (config.username !== undefined) {
    localStorage.setItem(IOL_USER_STORAGE, config.username.trim());
  }
}

export function clearIOLConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(IOL_ENDPOINT_STORAGE);
  localStorage.removeItem(IOL_TOKEN_STORAGE);
  localStorage.removeItem(IOL_USER_STORAGE);
  iolMcpClient.setToken('');
}

export async function testIOLConnection(config?: IOLConfig): Promise<{
  online: boolean;
  latencyMs: number;
  message: string;
  tools: string[];
}> {
  const conf = config || getIOLConfig();
  if (conf.token) {
    iolMcpClient.setToken(conf.token);
  }

  const pingRes = await iolMcpClient.ping();
  const tools = await iolMcpClient.listTools();

  return {
    online: pingRes.online,
    latencyMs: pingRes.latencyMs,
    message: pingRes.message,
    tools: tools.map((t) => t.name),
  };
}
