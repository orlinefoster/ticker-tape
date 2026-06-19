# Spec: SQLite CRUD

> Phase 1 — Foundation
> Capability: `db-layer`

---

## Requirements

### REQ-DB-01: Database Initialization
On app startup:
- Determine DB path: `{app_local_data_dir}/ticker-tape.db`
- Ensure parent directory exists
- Create connection pool (`SqlitePool`) with max 5 connections
- Run all pending migrations via `sqlx::migrate!()`
- Store pool in a global `once_cell` or `tokio::sync::OnceCell`

### REQ-DB-02: Connection Management
- `init_db(path: &Path) -> Result<()>` — idempotent init function
- `get_db() -> Option<&Pool<Sqlite>>` — accessor
- Pool configured with: `busy_timeout = 5000`, `journal_mode = WAL`
- Connection pool lives for the entire app lifetime

### REQ-DB-03: Migration: `market_data`
Table (already defined in initial migration):
- `symbol TEXT NOT NULL`, `date TEXT NOT NULL`, `open REAL`, `high REAL`, `low REAL`, `close REAL`, `volume REAL`, `updated_at TEXT`
- Composite PK: `(symbol, date)`
- Index: `(symbol, date DESC)`

### REQ-DB-04: Migration: `strategies`
Table (already defined):
- `id TEXT PK`, `name TEXT`, `description TEXT`, `config TEXT` (JSON), `created_at`, `updated_at`
- Seed data: insert "MA Crossover", "Bollinger Bands", "RSI" with default configs

### REQ-DB-05: Migration: `signals`, `orders`, `portfolio_snapshots`
Tables already defined in initial migration. Keep as-is for Phase 1 (no CRUD needed yet — just exist).

### REQ-DB-06: MarketData Repository
`trait MarketDataRepository` with:
- `async fn upsert_bars(pool: &Pool, bars: &[OHLCVBar]) -> Result<u64>` — bulk upsert, returns count
- `async fn get_bars(pool: &Pool, symbol: &str, from: &str, to: &str) -> Result<Vec<OHLCVBar>>` — range query
- `async fn get_latest_date(pool: &Pool, symbol: &str) -> Result<Option<String>>` — for cache freshness check
- `async fn delete_older_than(pool: &Pool, symbol: &str, date: &str) -> Result<u64>` — cleanup

### REQ-DB-07: Strategy Repository
`trait StrategyRepository` with:
- `async fn save(pool: &Pool, strategy: &StrategyConfig) -> Result<()>`
- `async fn get_all(pool: &Pool) -> Result<Vec<StrategyConfig>>`
- `async fn get_by_id(pool: &Pool, id: &str) -> Result<Option<StrategyConfig>>`
- `async fn update_config(pool: &Pool, id: &str, config: &Value) -> Result<()>`
- `async fn delete(pool: &Pool, id: &str) -> Result<bool>` — returns whether any row was deleted

### REQ-DB-08: Error Handling
- All DB errors wrapped in `DbError` enum: `Connection`, `Migration`, `Query`, `NotFound`
- `DbError` implements `std::error::Error` and converts to `anyhow::Error`
- Repository methods return `Result<T, DbError>`

### REQ-DB-09: Testing
- In-memory SQLite for tests (`sqlite::memory:`)
- Test fixtures: insert known bars, verify queries return correct ranges
- Test edge: empty tables, missing symbols, date boundaries

---

## Scenarios

### Happy Path: Init + Migration
1. App starts → `init_db()` called with valid path
2. Pool created, migrations run → `market_data` table exists
3. `get_db()` returns `Some(pool)`
4. Ready for queries

### Happy Path: Upsert + Query
1. Insert 5 bars for "SPY" via `upsert_bars()`
2. Query `get_bars("SPY", "2024-01-01", "2024-12-31")` → returns 5 bars
3. Insert same 5 bars again → upsert succeeds (no duplicates), count = 5
4. Query `get_latest_date("SPY")` → returns last date

### Error Path: Table Not Found
1. Migration fails or table is missing
2. `get_bars("SPY", ...)` → returns `DbError::Query`
3. Caller handles error gracefully

### Error Path: Pool Not Initialized
1. `init_db()` not called
2. `get_db()` returns `None`
3. Repository functions return `DbError::Connection` with clear message

### Edge Case: Boundary Dates
1. Insert bars for 2024-01-01 to 2024-12-31
2. Query `from="2024-06-01", to="2024-06-30"` → returns only June bars
3. Query with `from > to` → returns empty (not crash)
4. Query non-existent symbol → returns empty

---

## Acceptance Criteria

- [ ] `init_db()` creates `.db` file, runs migrations, pool is usable
- [ ] All migration SQL compiles and runs without error
- [ ] `MarketDataRepository` upsert + query works on in-memory SQLite
- [ ] `StrategyRepository` CRUD works on in-memory SQLite
- [ ] Seed data: 3 strategies inserted on first migration
- [ ] WAL mode confirmed: `PRAGMA journal_mode` returns `wal`
- [ ] All error paths tested (connection failure, query failure, not found)
