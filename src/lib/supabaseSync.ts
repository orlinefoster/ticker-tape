/**
 * Supabase Cloud Sync Engine for Ticker Tape
 * Handles centralized synchronization of market candles, portfolio holdings,
 * transactions, and daily equity snapshots.
 */

import { getSupabaseConfig, OHLCVBar } from './tauri';
import { usePortfolioStore } from '@/store/portfolioStore';

export interface CloudSyncStatus {
  lastSyncTimestamp: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  message: string;
}

/**
 * Pushes the local portfolio state (holdings, transactions, and equity snapshots) to Supabase Cloud.
 */
export async function pushPortfolioToSupabase(): Promise<{ success: boolean; message: string }> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return {
      success: false,
      message: 'Supabase URL o Anon Key no configuradas en el módulo de Proveedores.',
    };
  }

  const cleanUrl = url.replace(/\/$/, '');
  const state = usePortfolioStore.getState();

  const snapshotPayload = {
    timestamp: new Date().toISOString(),
    total_usd: state.getTotalNetWorthUsd(),
    total_ars: state.getTotalNetWorthUsd() * state.rates.ccl,
    cash_usd: state.getCashValuationUsd(),
    iol_usd: state.getIOLValuationUsd(),
    binance_usd: state.getBinanceValuationUsd(),
    rates: state.rates,
    cash_holdings_count: state.cashHoldings.length,
    iol_holdings_count: state.iolHoldings.length,
    binance_holdings_count: state.binanceHoldings.length,
    transactions_count: state.transactions.length,
  };

  try {
    const endpoint = `${cleanUrl}/rest/v1/portfolio_snapshots`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(snapshotPayload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        message: `Error Supabase (${res.status}): ${errText || 'No se pudo guardar el snapshot'}`,
      };
    }

    return {
      success: true,
      message: `✅ Snapshot patrimonial de $${snapshotPayload.total_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD sincronizado en Supabase Cloud.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Error de red al sincronizar con Supabase: ${msg}`,
    };
  }
}

/**
 * Pushes historical market candle batches to Supabase to minimize external API queries.
 */
export async function pushCandlesToSupabase(bars: OHLCVBar[]): Promise<{ success: boolean; inserted: number }> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || bars.length === 0) return { success: false, inserted: 0 };

  const cleanUrl = url.replace(/\/$/, '');
  const endpoint = `${cleanUrl}/rest/v1/market_candles`;

  const payload = bars.map((b) => ({
    symbol: b.symbol.toUpperCase(),
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
    provider: 'ticker-tape-sync',
    updated_at: new Date().toISOString(),
  }));

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return {
      success: res.ok,
      inserted: res.ok ? bars.length : 0,
    };
  } catch {
    return { success: false, inserted: 0 };
  }
}
