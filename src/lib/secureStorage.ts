import { StateStorage } from 'zustand/middleware';
import { useAuthStore } from '../store/authStore';

/**
 * Custom Zustand StateStorage adapter that integrates with the
 * hardware-grade encrypted SQLite vault when unlocked.
 */
export const secureVaultStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const auth = useAuthStore.getState();
      if (auth.isUnlocked) {
        const encryptedData = await auth.loadEncrypted<string | Record<string, unknown>>(name);
        if (encryptedData !== null) {
          // If encrypted data exists, clean up any plaintext legacy in localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(name);
          }
          return typeof encryptedData === 'string'
            ? encryptedData
            : JSON.stringify(encryptedData);
        }

        // Migration path: if unlocked but not yet in vault, check localStorage legacy
        if (typeof localStorage !== 'undefined') {
          const legacy = localStorage.getItem(name);
          if (legacy !== null) {
            await auth.saveEncrypted(name, legacy);
            localStorage.removeItem(name);
            return legacy;
          }
        }
        return null;
      }

      // If initialized but locked, DO NOT leak data from localStorage!
      if (auth.isInitialized) {
        return null;
      }
    } catch {
      // Ignore and fallback
    }

    // Only allow localStorage fallback if vault is NOT initialized
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(name);
    }
    return null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const auth = useAuthStore.getState();
      if (auth.isUnlocked) {
        await auth.saveEncrypted(name, value);
        // Wipe any plaintext duplicate in localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(name);
        }
        return;
      }

      // If vault is initialized but currently locked, refuse to write plaintext!
      if (auth.isInitialized) {
        return;
      }
    } catch {
      // Ignore
    }

    // Fallback: only if vault has never been initialized
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const auth = useAuthStore.getState();
      if (auth.isUnlocked) {
        await auth.deleteEncrypted(name);
      }
    } catch {
      // Ignore
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(name);
    }
  },
};
