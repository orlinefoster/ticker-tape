import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tauriLib from './tauri';
import { pushPortfolioToSupabase, pushCandlesToSupabase } from './supabaseSync';

describe('supabaseSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns graceful message when Supabase config is missing', async () => {
    vi.spyOn(tauriLib, 'getSupabaseConfig').mockReturnValue({ url: '', key: '' });
    const result = await pushPortfolioToSupabase();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Supabase URL o Anon Key no configuradas');
  });

  it('handles empty candle array gracefully', async () => {
    const result = await pushCandlesToSupabase([]);
    expect(result.success).toBe(false);
    expect(result.inserted).toBe(0);
  });

  it('handles network errors gracefully during pushPortfolioToSupabase', async () => {
    vi.spyOn(tauriLib, 'getSupabaseConfig').mockReturnValue({ url: 'https://mock.supabase.co', key: 'mock-key' });
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    const result = await pushPortfolioToSupabase();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Network failure');
  });
});

