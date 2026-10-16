import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isInitialized: false,
      isUnlocked: false,
      username: null,
      isLoading: false,
      error: null,
      autoLockMinutes: 15,
      lastActivity: Date.now(),
    });
  });

  it('initializes with default locked and uninitialized state', () => {
    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(false);
    expect(state.isUnlocked).toBe(false);
    expect(state.username).toBeNull();
  });

  it('sets up a new vault successfully', async () => {
    const ok = await useAuthStore.getState().setupVault('TraderAlice', '5678');
    expect(ok).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isUnlocked).toBe(true);
    expect(state.username).toBe('TraderAlice');
  });

  it('rejects short PIN during setup', async () => {
    const ok = await useAuthStore.getState().setupVault('TraderAlice', '12');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toContain('al menos 4 caracteres');
  });

  it('locks vault and restores unlock with correct PIN', async () => {
    await useAuthStore.getState().setupVault('TraderBob', '9999');
    await useAuthStore.getState().lockVault();

    expect(useAuthStore.getState().isUnlocked).toBe(false);

    const wrongAttempt = await useAuthStore.getState().unlockVault('0000');
    expect(wrongAttempt).toBe(false);
    expect(useAuthStore.getState().isUnlocked).toBe(false);

    const rightAttempt = await useAuthStore.getState().unlockVault('9999');
    expect(rightAttempt).toBe(true);
    expect(useAuthStore.getState().isUnlocked).toBe(true);
  });

  it('saves and loads encrypted data', async () => {
    await useAuthStore.getState().setupVault('TraderBob', '9999');

    const sample = { spyAllocation: 60, sectors: ['XLK', 'XLF'] };
    const saved = await useAuthStore.getState().saveEncrypted('spy_plan', sample);
    expect(saved).toBe(true);

    const loaded = await useAuthStore.getState().loadEncrypted<typeof sample>('spy_plan');
    expect(loaded).toEqual(sample);
  });
});
