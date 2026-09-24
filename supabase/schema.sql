-- ==============================================================================
-- Ticker Tape - Supabase Cloud Synchronization Schema
-- Execute this script in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ==============================================================================

-- 1. Shared Market Candles Cache (Avoid repeating Yahoo/Binance/IOL requests)
CREATE TABLE IF NOT EXISTS public.market_candles (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    provider TEXT NOT NULL DEFAULT 'ticker-tape-sync',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_market_candles_symbol_date ON public.market_candles (symbol, date DESC);

-- Enable Row Level Security (RLS) and allow public read/write with anon key
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read market_candles" ON public.market_candles FOR SELECT USING (true);
CREATE POLICY "Allow anon insert/update market_candles" ON public.market_candles FOR ALL USING (true);

-- 2. Daily Portfolio Snapshots (Tracks net worth evolution across devices)
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_usd DOUBLE PRECISION NOT NULL,
    total_ars DOUBLE PRECISION NOT NULL,
    cash_usd DOUBLE PRECISION NOT NULL,
    iol_usd DOUBLE PRECISION NOT NULL,
    binance_usd DOUBLE PRECISION NOT NULL,
    rates JSONB DEFAULT '{}'::jsonb,
    cash_holdings_count INTEGER DEFAULT 0,
    iol_holdings_count INTEGER DEFAULT 0,
    binance_holdings_count INTEGER DEFAULT 0,
    transactions_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON public.portfolio_snapshots (timestamp DESC);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read portfolio_snapshots" ON public.portfolio_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow anon insert portfolio_snapshots" ON public.portfolio_snapshots FOR INSERT WITH CHECK (true);

-- 3. Master Portfolios (Cash, IOL, Binance)
CREATE TABLE IF NOT EXISTS public.portfolios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'iol', 'binance')),
    base_currency TEXT NOT NULL DEFAULT 'USD',
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all portfolios" ON public.portfolios FOR ALL USING (true);

-- 4. Holdings / Positions
CREATE TABLE IF NOT EXISTS public.positions (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    avg_buy_price DOUBLE PRECISION NOT NULL,
    current_price DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON public.positions (portfolio_id);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all positions" ON public.positions FOR ALL USING (true);

-- 5. Auditable Transactions Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('COMPRA', 'VENTA', 'DEPOSITO', 'EXTRACCION', 'DIVIDENDO', 'INTERES')),
    symbol TEXT,
    quantity DOUBLE PRECISION,
    price DOUBLE PRECISION,
    currency TEXT NOT NULL,
    total_nominal DOUBLE PRECISION NOT NULL,
    commission DOUBLE PRECISION DEFAULT 0.0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_time ON public.transactions (portfolio_id, timestamp DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all transactions" ON public.transactions FOR ALL USING (true);
