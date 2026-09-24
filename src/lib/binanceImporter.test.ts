import { describe, it, expect } from 'vitest';
import { parseBinanceCsv, reconcileBinanceRecords } from './binanceImporter';
import { BinanceHolding } from '@/store/portfolioStore';

describe('binanceImporter', () => {
  it('parses Binance Trade History CSV correctly', () => {
    const tradeCsv = `Date(UTC),Market,Type,Price,Amount,Total,Fee,Fee Coin
2026-09-01 10:30:00,BTCUSDT,BUY,60000.0,0.1,6000.0,6.0,USDT
2026-09-10 14:15:00,ETHUSDT,BUY,3000.0,1.0,3000.0,3.0,USDT
2026-09-20 18:00:00,BTCUSDT,SELL,65000.0,0.05,3250.0,3.25,USDT`;

    const records = parseBinanceCsv(tradeCsv);
    expect(records.length).toBe(3);

    expect(records[0].symbol).toBe('BTC');
    expect(records[0].type).toBe('COMPRA');
    expect(records[0].amount).toBe(0.1);
    expect(records[0].price).toBe(60000.0);

    expect(records[2].symbol).toBe('BTC');
    expect(records[2].type).toBe('VENTA');
    expect(records[2].amount).toBe(0.05);
    expect(records[2].price).toBe(65000.0);
  });

  it('parses Binance Transaction History CSV correctly', () => {
    const txCsv = `UTC_Time,Account,Operation,Coin,Change,Remark
2026-09-05 12:00:00,Spot,Deposit,USDT,5000,Internal transfer
2026-09-06 15:30:00,Spot,Withdraw,USDT,-1000,External withdrawal`;

    const records = parseBinanceCsv(txCsv);
    expect(records.length).toBe(2);

    expect(records[0].symbol).toBe('USDT');
    expect(records[0].type).toBe('DEPOSITO');
    expect(records[0].amount).toBe(5000);

    expect(records[1].symbol).toBe('USDT');
    expect(records[1].type).toBe('EXTRACCION');
    expect(records[1].amount).toBe(1000);
  });

  it('reconciles records and updates holdings appropriately', () => {
    const existingHoldings: BinanceHolding[] = [
      {
        id: 'bin-1',
        symbol: 'BTC',
        name: 'Bitcoin Spot',
        amount: 0.1,
        avgBuyPriceUsdt: 50000.0,
        currentPriceUsdt: 67000.0,
      },
    ];

    const records = [
      {
        timestamp: '2026-09-20T10:00:00Z',
        type: 'COMPRA' as const,
        symbol: 'BTC',
        amount: 0.1,
        price: 60000.0,
        totalUsdt: 6000.0,
      },
    ];

    const result = reconcileBinanceRecords(records, existingHoldings, { BTC: 67000 });

    expect(result.recordsParsed).toBe(1);
    expect(result.transactionsGenerated.length).toBe(1);

    const btcHolding = result.updatedHoldings.find((h) => h.symbol === 'BTC');
    expect(btcHolding).toBeDefined();
    expect(btcHolding?.amount).toBeCloseTo(0.2, 5);
    // (0.1 * 50000 + 0.1 * 60000) / 0.2 = 55000
    expect(btcHolding?.avgBuyPriceUsdt).toBeCloseTo(55000, 0);
  });
});
