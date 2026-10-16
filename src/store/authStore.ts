import { create } from 'zustand';
import { commands, VaultStatus } from '../lib/tauri';

export interface AuthState {
  isInitialized: boolean;
  isUnlocked: boolean;
  username: string | null;
  isLoading: boolean;
  error: string | null;
  autoLockMinutes: number;
  lastActivity: number;

  // Actions
  checkStatus: () => Promise<VaultStatus>;
  setupVault: (username: string, pin: string) => Promise<boolean>;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
  saveEncrypted: (key: string, data: unknown) => Promise<boolean>;
  loadEncrypted: <T = unknown>(key: string) => Promise<T | null>;
  deleteEncrypted: (key: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  setAutoLockMinutes: (minutes: number) => void;
  recordActivity: () => void;
  checkAutoLock: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitialized: false,
  isUnlocked: false,
  username: null,
  isLoading: false,
  error: null,
  autoLockMinutes: 15,
  lastActivity: Date.now(),

  checkStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await commands.vaultGetStatus();
      set({
        isInitialized: status.is_initialized,
        isUnlocked: status.is_unlocked,
        username: status.username,
        isLoading: false,
      });
      return status;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      return { is_initialized: false, is_unlocked: false, username: null };
    }
  },

  setupVault: async (username: string, pin: string) => {
    if (!username.trim() || pin.length < 4) {
      set({ error: 'El usuario no puede estar vacío y el PIN debe tener al menos 4 caracteres.' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      await commands.vaultSetup(username.trim(), pin);
      set({
        isInitialized: true,
        isUnlocked: true,
        username: username.trim(),
        lastActivity: Date.now(),
        isLoading: false,
      });
      // Migrate or rehydrate portfolio store from decrypted vault
      try {
        const { usePortfolioStore } = await import('./portfolioStore');
        await usePortfolioStore.persist?.rehydrate();
      } catch {
        // Ignore if store not yet mounted
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  unlockVault: async (pin: string) => {
    if (!pin) {
      set({ error: 'Por favor ingrese su PIN / contraseña.' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await commands.vaultUnlock(pin);
      set({
        isUnlocked: true,
        username: user || get().username,
        lastActivity: Date.now(),
        isLoading: false,
        error: null,
      });
      // Rehydrate portfolio store from decrypted vault
      try {
        const { usePortfolioStore } = await import('./portfolioStore');
        await usePortfolioStore.persist?.rehydrate();
      } catch {
        // Ignore if store not yet mounted
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg || 'PIN incorrecto', isLoading: false });
      return false;
    }
  },

  lockVault: async () => {
    try {
      await commands.vaultLock();
    } finally {
      set({
        isUnlocked: false,
        isLoading: false,
        error: null,
      });
    }
  },

  saveEncrypted: async (key: string, data: unknown) => {
    try {
      const payload = JSON.stringify(data);
      await commands.vaultSaveData(key, payload);
      get().recordActivity();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  loadEncrypted: async <T = unknown>(key: string): Promise<T | null> => {
    try {
      const raw = await commands.vaultLoadData(key);
      if (!raw) return null;
      get().recordActivity();
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },

  deleteEncrypted: async (key: string) => {
    try {
      const ok = await commands.vaultDeleteData(key);
      get().recordActivity();
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  changePin: async (oldPin: string, newPin: string) => {
    if (newPin.length < 4) {
      set({ error: 'El nuevo PIN debe tener al menos 4 caracteres.' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      await commands.vaultChangePin(oldPin, newPin);
      set({ isLoading: false, lastActivity: Date.now() });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  setAutoLockMinutes: (minutes: number) => {
    set({ autoLockMinutes: Math.max(1, minutes) });
  },

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  checkAutoLock: () => {
    const { isUnlocked, lastActivity, autoLockMinutes, lockVault } = get();
    if (!isUnlocked || autoLockMinutes <= 0) return;

    const elapsedMs = Date.now() - lastActivity;
    if (elapsedMs > autoLockMinutes * 60 * 1000) {
      lockVault();
    }
  },

  clearError: () => set({ error: null }),
}));
