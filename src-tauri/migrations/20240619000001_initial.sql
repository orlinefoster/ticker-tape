-- Initial schema for Ticker Tape trading system

CREATE TABLE IF NOT EXISTS market_data (
    symbol      TEXT NOT NULL,
    date        TEXT NOT NULL,
    open        REAL NOT NULL,
    high        REAL NOT NULL,
    low         REAL NOT NULL,
    close       REAL NOT NULL,
    volume      REAL NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (symbol, date)
);

CREATE INDEX idx_market_data_symbol_date ON market_data(symbol, date DESC);

CREATE TABLE IF NOT EXISTS strategies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    config      TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signals (
    id          TEXT PRIMARY KEY,
    symbol      TEXT NOT NULL,
    strategy_id TEXT REFERENCES strategies(id),
    direction   TEXT NOT NULL CHECK (direction IN ('buy', 'sell', 'neutral')),
    strength    REAL NOT NULL DEFAULT 0.0,
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_signals_symbol_created ON signals(symbol, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    symbol      TEXT NOT NULL,
    side        TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity    REAL NOT NULL,
    price       REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    filled_at   TEXT
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id          TEXT PRIMARY KEY,
    total_value REAL NOT NULL,
    cash        REAL NOT NULL,
    positions   TEXT NOT NULL DEFAULT '[]',
    risk_metrics TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_portfolio_snapshots_created ON portfolio_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    synced_at   TEXT NOT NULL DEFAULT (datetime('now')),
    synced      INTEGER NOT NULL DEFAULT 0
);
