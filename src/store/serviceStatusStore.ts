import { create } from 'zustand';
import { commands } from '../lib/tauri';

const STORAGE_KEY = 'ticker-tape-service-status-override';

export type ServiceStatus = 'connected' | 'mock' | 'disconnected';
export type OverrideSetting = 'Real' | 'Mock' | 'Auto';

export interface ServiceStatusState {
  status: {
    db: ServiceStatus;
    ai: ServiceStatus;
    data: ServiceStatus;
    binance: ServiceStatus;
  };
  override: OverrideSetting;
  setOverride: (override: OverrideSetting) => void;
  pollStatus: () => Promise<void>;
}

function loadPersistedOverride(): OverrideSetting {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'Real' || raw === 'Mock' || raw === 'Auto') {
        return raw;
      }
    }
  } catch {
    // Ignore and use default
  }
  return 'Auto';
}

function persistOverride(override: OverrideSetting): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, override);
    }
  } catch {
    // Ignore and degrade gracefully
  }
}

export const useServiceStatusStore = create<ServiceStatusState>((set, get) => {
  const initialOverride = loadPersistedOverride();
  const initialStatus: ServiceStatusState['status'] =
    initialOverride === 'Mock'
      ? { db: 'mock', ai: 'mock', data: 'mock', binance: 'mock' }
      : { db: 'disconnected', ai: 'disconnected', data: 'disconnected', binance: 'disconnected' };

  return {
    status: initialStatus,
    override: initialOverride,

    setOverride: (override: OverrideSetting) => {
      set({ override });
      persistOverride(override);

      if (override === 'Mock') {
        set({
          status: { db: 'mock', ai: 'mock', data: 'mock', binance: 'mock' },
        });
      } else {
        get().pollStatus();
      }
    },

    pollStatus: async () => {
      const { override } = get();
      if (override === 'Mock') {
        set({
          status: { db: 'mock', ai: 'mock', data: 'mock', binance: 'mock' },
        });
        return;
      }

      try {
        const backendStatus = await commands.checkServicesStatus();

        const mapStatus = (connected: boolean): ServiceStatus => {
          if (override === 'Real') {
            return connected ? 'connected' : 'disconnected';
          } else {
            // 'Auto' mode: dynamic fallback to 'mock' on failure
            return connected ? 'connected' : 'mock';
          }
        };

        set({
          status: {
            db: mapStatus(backendStatus.db),
            ai: mapStatus(backendStatus.ai),
            data: mapStatus(backendStatus.data),
            binance: mapStatus(backendStatus.binance),
          },
        });
      } catch (error) {
        // On Tauri invoke failure, set all to disconnected
        set({
          status: { db: 'disconnected', ai: 'disconnected', data: 'disconnected', binance: 'disconnected' },
        });
      }
    },
  };
});

// Setup background interval (15 seconds) if not in test environment
if (typeof window !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV !== 'test') {
  // Trigger initial poll
  useServiceStatusStore.getState().pollStatus();
  
  setInterval(() => {
    useServiceStatusStore.getState().pollStatus();
  }, 15000);
}
