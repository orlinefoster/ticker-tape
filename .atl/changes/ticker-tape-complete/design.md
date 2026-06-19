# Design: Ticker-Tape — Phase 1 Foundation

## Technical Approach

Phase 1 delivers three independent capabilities that form the bedrock: Rust trading engine core (extending `ticker_tape_lib`), React/TypeScript app shell with Tauri IPC bridge, and SQLite persistence via sqlx. Each extends existing scaffolding (models, basic strategy trait, DB init, initial migration) to full spec coverage. The crate remains a single library with sub-modules — no workspace split until module count justifies it in Phase 2+.

---

## Architecture Decisions

### Decision: Single Crate with Sub-Modules

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Workspace with 3 crates | Strong isolation, slower compile | ✗ — overkill for Phase 1 |
| Single `ticker_tape_lib` with flat modules | Simple, matches existing `mod.rs` pattern | ✓ — extend existing |

### Decision: sqlx over Diesel

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Diesel | Sync-only, compile-time schema DSL, heavyweight | ✗ — more boilerplate for SQLite |
| sqlx | Async-native, compile-time checked, simpler for SQLite | ✓ — already in `db/mod.rs` and `Cargo.toml` |

### Decision: Zustand over Redux

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Redux Toolkit | Standard for large apps, more boilerplate | ✗ — overkill for Phase 1 |
| Zustand | Minimal API, TS-native, 1kB | ✓ — already in `package.json`, proven in orlines-lab |

### Decision: State-Based Routing over react-router

| Option | Tradeoff | Decision |
|--------|----------|----------|
| react-router | URL-based, loaders — desktop app has no URL bar | ✗ — unnecessary dependency |
| `useUIStore.activeRoute` | `string` → conditional render | ✓ — matches spec REQ-SHL-02 explicitly |

---

## C4 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User (Desktop App User)                                 │
│  Uses the app for charting, backtesting, analysis        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Ticker Tape (Tauri v2 Desktop App)                     │
│  ├── React Frontend (UI, state, charts)                 │
│  ├── Tauri IPC Bridge (typed invoke/event)              │
│  └── Rust Backend (engine, DB, MCP, Ollama)             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  SQLite (Local DB)       │  External APIs (Yahoo, etc)  │
│  WAL mode, max 5 conns   │  reqwest over HTTPS          │
└─────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
lib.rs — entry point, command registration
├── trading/
│   ├── mod.rs           — TradingConfig
│   ├── models.rs        — OHLCVBar, Signal, Order, Portfolio, RiskMetrics
│   ├── bar_collection   — NEW: sorted Vec wrapper, SMA, returns
│   ├── strategies.rs    — Strategy trait + MACrossover, BollingerBands, RSI
│   ├── signals.rs       — SignalAggregator (consensus voting)
│   ├── market_data.rs   — fetch_historical_data, preprocess
│   ├── risk.rs          — VaR, Sharpe, max drawdown, volatility
│   └── backtest         — NEW: Backtester, BacktestResult, position tracking
├── db/
│   ├── mod.rs           — init_db, get_db (OnceCell)
│   ├── market_data_repo — NEW: MarketDataRepository impl
│   └── strategy_repo    — NEW: StrategyRepository impl
├── mcp/mod.rs           (stub for Phase 1)
└── ollama/mod.rs        (stub for Phase 1)
```

---

## Data Flow

### App Startup
```
main → lib::run()
  → setup hook: spawn init_db(path)
    → create_dir_all, pool(conns=5, WAL, busy=5000)
    → migrate!() → seed 3 strategies
    → store pool in OnceCell
  → register greet, fetch_market_data, run_strategy, run_backtest
  → Tauri window → React mount
  → useUIStore init from localStorage (theme, sidebar)
  → Dashboard placeholder renders
```

### Market Data Fetch
```
React: useMarketDataStore.fetchData("SPY", "1y")
  → store.loading.add("SPY")
  → invoke("fetch_market_data", { symbol, range })
  → [serde JSON across IPC]
  → Rust: MarketDataRepo::get_bars("SPY", from, to)
    ├─ cached → return bars
    └─ miss → fetch_historical_data → upsert_bars → return
  → store.cache.set("SPY", bars), store.loading.delete("SPY")
```

### Strategy Backtest
```
React: invoke("run_backtest", { symbol, strategy: "macd", params })
  → Rust: get bars from DB → BarCollection::new(bars)
  → MACrossover::evaluate(symbol, bars) → Vec<Signal>
  → Backtester::new(100_000).run(strategy, bars)
    → for each bar: check signal → enter/exit positions
    → track equity_curve, trades, drawdown
  → return BacktestResult across IPC
  → React renders result table + equity curve
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | Modify | Add `async-trait`, `uuid` |
| `src-tauri/src/trading/bar_collection.rs` | Create | `BarCollection` — sorted Vec, SMA, `returns()` |
| `src-tauri/src/trading/backtest.rs` | Create | `Backtester` event loop, position tracking |
| `src-tauri/src/trading/mod.rs` | Modify | Add `bar_collection`, `backtest` modules |
| `src-tauri/src/trading/strategies.rs` | Modify | Add `parameters()` to trait, `BollingerBands`, `RSI`, `ParamDef` |
| `src-tauri/src/trading/signals.rs` | Modify | Add strategy registry, `add_strategy()`, weighted consensus |
| `src-tauri/src/trading/risk.rs` | Modify | Add `calculate_volatility`, empty-safety guards |
| `src-tauri/src/db/mod.rs` | Modify | Replace `static mut` → `OnceCell`, add repos |
| `src-tauri/src/db/market_data_repo.rs` | Create | `MarketDataRepository` — upsert, get_bars, get_latest_date, delete |
| `src-tauri/src/db/strategy_repo.rs` | Create | `StrategyRepository` — save, get_all, get_by_id, update_config, delete |
| `src-tauri/src/lib.rs` | Modify | Register new commands, await init_db during setup |
| `src/shell/layout.tsx` | Create | Shell: Sidebar + TopBar + ContentArea |
| `src/shell/sidebar.tsx` | Create | Nav list, collapse toggle, localStorage |
| `src/shell/topbar.tsx` | Create | App title, theme toggle, status indicator |
| `src/store/uiStore.ts` | Create | `theme`, `sidebarCollapsed`, `activeRoute` + actions |
| `src/store/marketDataStore.ts` | Create | `cache`, `loading`, `errors` + `fetchData`/`getData` |
| `src/lib/tauri.ts` | Create | Typed `invoke<>()` wrappers for all commands |
| `src/lib/errorBoundary.tsx` | Create | Top-level + per-module error boundaries |
| `src/theme/theme.css` | Create | CSS custom properties, light/dark variants |
| `src/theme/useTheme.ts` | Create | Hook: apply theme class, manage transition |
| `src/App.tsx` | Modify | Replace placeholder with `<Shell>` |
| `src/index.css` | Modify | Add theme var references, min-height reset |

---

## Key Interfaces

```rust
// BarCollection — owned Vec with validation
pub struct BarCollection(Vec<OHLCVBar>);
impl BarCollection {
    pub fn new(bars: Vec<OHLCVBar>) -> Result<Self, ValidationError>; // auto-sorts
    pub fn returns(&self, method: ReturnMethod) -> Vec<f64>;
    pub fn apply_sma(&self, period: usize) -> Vec<Option<f64>>;
}

// Enhanced Strategy trait
#[async_trait]
pub trait Strategy: Send + Sync {
    fn name(&self) -> &str;
    fn parameters(&self) -> Vec<ParamDef>;
    async fn evaluate(&self, symbol: &str, bars: &BarCollection) -> Vec<Signal>;
}

pub struct ParamDef {
    pub name: String, pub type_: ParamType,
    pub default: Value, pub min: Option<f64>, pub max: Option<f64>,
}

// Backtester
pub struct Backtester { initial_capital: f64, risk_per_trade: f64 }
pub struct BacktestResult {
    pub total_return: f64, pub annualized_return: f64,
    pub sharpe: f64, pub max_drawdown: f64, pub win_rate: f64,
    pub num_trades: usize, pub equity_curve: Vec<f64>,
}
```

```typescript
// src/lib/tauri.ts — typed IPC bridge
export const cmd = {
  greet: (name: string) => invoke<string>('greet', { name }),
  fetchMarketData: (symbol: string, range: string) =>
    invoke<OHLCVBar[]>('fetch_market_data', { symbol, range }),
  runBacktest: (symbol: string, strategy: string, params: Record<string, unknown>) =>
    invoke<BacktestResult>('run_backtest', { symbol, strategy, params }),
};

// src/store/uiStore.ts
interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeRoute: string;
  toggleSidebar: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  setActiveRoute: (r: string) => void;
}
```

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Rust unit | BarCollection validation, SMA, returns | `#[cfg(test)]` — synthetic bars |
| Rust unit | MACrossover crossover detection | Known crossover data |
| Rust unit | Backtester P&L on one Buy→Sell cycle | Verify equity curve and metrics |
| Rust unit | Risk functions (VaR, Sharpe, DD, vol) | Match reference computations |
| Rust unit | DB repositories | In-memory SQLite (`sqlite:memory:`) |
| Frontend | Zustand store actions | Vitest — pure store tests |
| Frontend | IPC bridge types | Mock `invoke`, verify type safety |

---

## Migration / Rollout

No data migration required — existing `20240619000001_initial.sql` has all tables. Add revision `00002` with seed data (`INSERT OR IGNORE` for 3 default strategies). Rollback: `git revert` the migration commit, then `sqlx migrate revert`.

---

## Open Questions

- [ ] BarCollection::new — auto-sort unsorted input or return error? Spec allows both; lean toward auto-sort with debug_assert to keep things moving.
- [ ] Backtester fee model — flat per-trade, percentage, or both for Phase 1? Spec doesn't mention fees; default to flat $0 for now.
