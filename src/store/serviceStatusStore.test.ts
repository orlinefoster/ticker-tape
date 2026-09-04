import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useServiceStatusStore } from './serviceStatusStore';
import { commands } from '../lib/tauri';

vi.mock('../lib/tauri', () => ({
  commands: {
    checkServicesStatus: vi.fn(),
  },
}));

const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

describe('useServiceStatusStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset store state to default
    useServiceStatusStore.setState({
      status: { db: 'disconnected', ai: 'disconnected', data: 'disconnected', binance: 'disconnected' },
      override: 'Auto',
    });
  });

  it('should initialize with default values', () => {
    const state = useServiceStatusStore.getState();
    expect(state.override).toBe('Auto');
    expect(state.status).toEqual({ db: 'disconnected', ai: 'disconnected', data: 'disconnected', binance: 'disconnected' });
  });

  it('should handle Mock override immediately without calling backend', async () => {
    const checkMock = commands.checkServicesStatus as any;
    useServiceStatusStore.getState().setOverride('Mock');
    
    expect(useServiceStatusStore.getState().override).toBe('Mock');
    expect(useServiceStatusStore.getState().status).toEqual({
      db: 'mock',
      ai: 'mock',
      data: 'mock',
      binance: 'mock',
    });
    expect(checkMock).not.toHaveBeenCalled();

    // polling in Mock mode should also bypass backend and stay as mock
    await useServiceStatusStore.getState().pollStatus();
    expect(checkMock).not.toHaveBeenCalled();
    expect(useServiceStatusStore.getState().status).toEqual({
      db: 'mock',
      ai: 'mock',
      data: 'mock',
      binance: 'mock',
    });
  });

  it('should map status correctly in Real override mode', async () => {
    const checkMock = commands.checkServicesStatus as any;
    // Mock backend returning db=true, ai=false, data=true, binance=true
    checkMock.mockResolvedValue({ db: true, ai: false, data: true, binance: true });

    useServiceStatusStore.getState().setOverride('Real');
    await useServiceStatusStore.getState().pollStatus();

    expect(checkMock).toHaveBeenCalled();
    expect(useServiceStatusStore.getState().status).toEqual({
      db: 'connected',
      ai: 'disconnected',
      data: 'connected',
      binance: 'connected',
    });
  });

  it('should map status correctly in Auto override mode', async () => {
    const checkMock = commands.checkServicesStatus as any;
    // Mock backend returning db=true, ai=false, data=false, binance=true
    checkMock.mockResolvedValue({ db: true, ai: false, data: false, binance: true });

    useServiceStatusStore.getState().setOverride('Auto');
    await useServiceStatusStore.getState().pollStatus();

    expect(checkMock).toHaveBeenCalled();
    expect(useServiceStatusStore.getState().status).toEqual({
      db: 'connected', // true -> connected
      ai: 'mock',      // false -> mock fallback
      data: 'mock',    // false -> mock fallback
      binance: 'connected', // true -> connected
    });
  });
});
