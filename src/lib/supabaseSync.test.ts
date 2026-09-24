import { describe, it, expect } from 'vitest';
import { pushPortfolioToSupabase, pushCandlesToSupabase } from './supabaseSync';

describe('supabaseSync', () => {
  it('returns graceful message when Supabase config is missing', async () => {
    // With no localStorage URL/KEY set, should return error message without throwing
    const result = await pushPortfolioToSupabase();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Supabase URL o Anon Key no configuradas');
  });

  it('handles empty candle array gracefully', async () => {
    const result = await pushCandlesToSupabase([]);
    expect(result.success).toBe(false);
    expect(result.inserted).toBe(0);
  });
});
