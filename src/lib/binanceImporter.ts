/**
 * Binance Movement & Trade History Parser and Reconciler
 * Supports both Binance "Transaction History" and "Trade History" CSV formats.
 */

import { UnifiedTransaction, BinanceHolding } from '@/store/portfolioStore';

export interface ParsedBinanceRecord {
  timestamp: string;
  type: 'COMPRA' | 'VENTA' | 'DEPOSITO' | 'EXTRACCION';
  symbol: string;
  amount: number;
  price?: number;
  totalUsdt: number;
  fee?: number;
  feeCoin?: string;
  rawOperation?: string;
}

export interface ReconciliationResult {
  recordsParsed: number;
  transactionsGenerated: UnifiedTransaction[];
  updatedHoldings: BinanceHolding[];
  totalDepositedUsdt: number;
  totalWithdrawnUsdt: number;
  netTradeVolumeUsdt: number;
}

/**
 * Parses raw CSV content exported from Binance.
 */
export function parseBinanceCsv(csvContent: string): ParsedBinanceRecord[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const isTradeHistory = header.includes('market') || header.includes('pair');
  const isTransactionHistory = header.includes('operation') || header.includes('change');

  const records: ParsedBinanceRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // Split by comma ignoring commas inside quotes
    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());

    if (cols.length < 4) continue;

    if (isTradeHistory) {
      // Format: Date(UTC), Market, Type, Price, Amount, Total, Fee, Fee Coin
      const [dateStr, market, typeStr, priceStr, amountStr, totalStr, feeStr, feeCoin] = cols;
      const type = typeStr.toUpperCase().includes('BUY') ? 'COMPRA' : 'VENTA';
      const cleanMarket = (market || '').replace(/USDT|BUSD|FDUSD|USDC/g, '').toUpperCase();
      const price = parseFloat(priceStr) || 0;
      const amount = parseFloat(amountStr) || 0;
      const total = parseFloat(totalStr) || price * amount;
      const fee = parseFloat(feeStr) || 0;

      records.push({
        timestamp: new Date(dateStr).toISOString(),
        type,
        symbol: cleanMarket || 'USDT',
        amount,
        price,
        totalUsdt: total,
        fee,
        feeCoin: feeCoin || 'USDT',
        rawOperation: `TRADE_${typeStr}`,
      });
    } else if (isTransactionHistory) {
      // Format: UTC_Time, Account, Operation, Coin, Change, Remark
      // Or: User_ID, UTC_Time, Account, Operation, Coin, Change, Remark
      const timeIdx = cols[0].includes('-') || cols[0].includes('/') ? 0 : 1;
      const dateStr = cols[timeIdx];
      const operation = (cols[timeIdx + 2] || '').toUpperCase();
      const coin = (cols[timeIdx + 3] || '').toUpperCase();
      const changeStr = cols[timeIdx + 4] || '0';
      const change = parseFloat(changeStr) || 0;

      let type: ParsedBinanceRecord['type'] = 'DEPOSITO';
      if (operation.includes('DEPOSIT') || operation.includes('BUY') || change > 0) {
        type = operation.includes('BUY') ? 'COMPRA' : 'DEPOSITO';
      } else if (operation.includes('WITHDRAW') || operation.includes('SELL') || change < 0) {
        type = operation.includes('SELL') ? 'VENTA' : 'EXTRACCION';
      }

      records.push({
        timestamp: new Date(dateStr).toISOString(),
        type,
        symbol: coin,
        amount: Math.abs(change),
        totalUsdt: coin === 'USDT' ? Math.abs(change) : 0,
        rawOperation: operation,
      });
    } else {
      // Generic fallback: Date, Symbol, Type, Amount, Price/Total
      const dateStr = cols[0];
      const symbol = cols[1]?.toUpperCase() || 'UNKNOWN';
      const typeStr = (cols[2] || '').toUpperCase();
      const amount = Math.abs(parseFloat(cols[3]) || 0);
      const price = Math.abs(parseFloat(cols[4]) || 0);

      records.push({
        timestamp: new Date(dateStr || Date.now()).toISOString(),
        type: typeStr.includes('SELL') ? 'VENTA' : 'COMPRA',
        symbol,
        amount,
        price,
        totalUsdt: price > 0 ? amount * price : amount,
        rawOperation: 'GENERIC_IMPORT',
      });
    }
  }

  return records;
}

/**
 * Reconciles parsed records into the application's Binance holdings and transactions ledger.
 */
export function reconcileBinanceRecords(
  records: ParsedBinanceRecord[],
  currentHoldings: BinanceHolding[],
  currentPrices: Record<string, number> = { BTC: 67250, ETH: 3180, SOL: 186.5, USDT: 1 }
): ReconciliationResult {
  const transactions: UnifiedTransaction[] = [];
  const holdingMap = new Map<string, { amount: number; totalCost: number }>();

  // Initialize with current holdings
  for (const h of currentHoldings) {
    holdingMap.set(h.symbol, {
      amount: h.amount,
      totalCost: h.amount * h.avgBuyPriceUsdt,
    });
  }

  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let netTradeVolume = 0;

  for (const rec of records) {
    transactions.push({
      id: `bin-sync-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: rec.timestamp,
      portfolioType: 'binance',
      type: rec.type,
      symbol: rec.symbol,
      quantity: rec.amount,
      price: rec.price,
      currency: 'USDT',
      totalNominal: rec.totalUsdt || rec.amount * (rec.price || currentPrices[rec.symbol] || 1),
      notes: `Importado de Binance: ${rec.rawOperation || rec.type}`,
    });

    const curr = holdingMap.get(rec.symbol) || { amount: 0, totalCost: 0 };

    if (rec.type === 'COMPRA' || rec.type === 'DEPOSITO') {
      const price = rec.price || currentPrices[rec.symbol] || 1;
      curr.amount += rec.amount;
      curr.totalCost += rec.amount * price;
      if (rec.type === 'DEPOSITO') totalDeposited += rec.totalUsdt;
      if (rec.type === 'COMPRA') netTradeVolume += rec.totalUsdt;
    } else if (rec.type === 'VENTA' || rec.type === 'EXTRACCION') {
      curr.amount = Math.max(0, curr.amount - rec.amount);
      if (rec.type === 'EXTRACCION') totalWithdrawn += rec.totalUsdt;
      if (rec.type === 'VENTA') netTradeVolume += rec.totalUsdt;
    }

    holdingMap.set(rec.symbol, curr);
  }

  // Format updated holdings
  const updatedHoldings: BinanceHolding[] = Array.from(holdingMap.entries())
    .filter(([_, data]) => data.amount > 0.0001)
    .map(([symbol, data]) => {
      const currentPrice = currentPrices[symbol] || (symbol === 'USDT' ? 1.0 : 100.0);
      const avgPrice = data.amount > 0 ? data.totalCost / data.amount : currentPrice;
      return {
        id: `bin-pos-${symbol}`,
        symbol,
        name: `${symbol} Spot`,
        amount: parseFloat(data.amount.toFixed(6)),
        avgBuyPriceUsdt: parseFloat(avgPrice.toFixed(2)),
        currentPriceUsdt: currentPrice,
        network: symbol === 'BTC' ? 'Bitcoin Core' : symbol === 'ETH' ? 'Ethereum' : 'Binance Spot',
      };
    });

  return {
    recordsParsed: records.length,
    transactionsGenerated: transactions,
    updatedHoldings,
    totalDepositedUsdt: totalDeposited,
    totalWithdrawnUsdt: totalWithdrawn,
    netTradeVolumeUsdt: netTradeVolume,
  };
}
