# Tasks: Ticker-Tape — Phase 1 Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1520 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Engine Core) → PR 2 (DB + Tauri) → PR 3 (React Shell) |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Scope |
|------|------|-----------|-------|
| 1 | Rust engine: BarCollection, strategies, backtest, risk, signals | PR 1 | `trading/*` — standalone, testable without DB or UI |
| 2 | DB (OnceCell, repos, migration 00002) + Tauri command wiring | PR 2 | `db/*`, `lib.rs`, `Cargo.toml` |
| 3 | React shell: IPC bridge, Zustand stores, theme, layout, integration | PR 3 | `src/*` |

---

## Tasks

### Phase 1: Engine Core (PR 1)

- **T01 — BarCollection wrapper**  
  Create `BarCollection(Vec<OHLCVBar>)` with sorted validation, `returns()`, `apply_sma()`, `len()`, `range()`. Update `mod.rs`.  
  **Files**: `bar_collection.rs` (C), `mod.rs` (M) | **Deps**: none  
  **Accept**: `cargo test` — validation rejects unsorted, SMA matches manual calc on 5-bar data | **M**

- **T02 — Strategy trait + BollingerBands + RSI + ParamDef**  
  Add `parameters()` to Strategy trait, `ParamDef` struct. Implement `BollingerBands { period, stddev }` and `RSI { period, overbought, oversold }`.  
  **Files**: `strategies.rs` (M) | **Deps**: T01  
  **Accept**: RSI Buy at oversold cross, Sell at overbought cross on synthetic data | **M**

- **T03 — SignalAggregator with strategy registry**  
  Add `add_strategy()` and weighted consensus voting: >50% Buy→Buy, >50% Sell→Sell, else Neutral.  
  **Files**: `signals.rs` (M) | **Deps**: T02  
  **Accept**: 2 Buy+1 Sell→Buy, 2 Sell+1 Buy→Sell, 1 Buy+1 Sell→Neutral | **S**

- **T04 — Backtester engine**  
  Create `Backtester::new(capital).run(strategy, bars)` with event loop, position tracking, P&L. Return `BacktestResult` (Sharpe, drawdown, win_rate, equity_curve).  
  **Files**: `backtest.rs` (C), `mod.rs` (M) | **Deps**: T01, T02  
  **Accept**: Buy→Sell cycle produces correct equity_curve, num_trades=1. Empty bars returns zeroed metrics | **L**

- **T05 — Risk functions completion**  
  Add `calculate_volatility()`, empty-safety guards to all functions. Wire `compute_risk_metrics()` to real calcs.  
  **Files**: `risk.rs` (M) | **Deps**: none  
  **Accept**: Volatility matches reference within 1e-6; empty slice returns 0.0 everywhere | **S**

### Phase 2: Database + Tauri Wiring (PR 2)

- **T06 — DB refactor + repositories + migration 00002**  
  Replace `static mut` with `OnceCell` for pool. Create `MarketDataRepository` (upsert_bars, get_bars, get_latest_date, delete_older_than) and `StrategyRepository` (save, get_all, get_by_id, update_config, delete). Migration 00002 seeds 3 strategies.  
  **Files**: `db/mod.rs` (M), `market_data_repo.rs` (C), `strategy_repo.rs` (C) | **Deps**: none  
  **Accept**: In-memory SQLite tests pass — upsert+query bars, CRUD strategies, WAL confirmed | **L**

- **T07 — Tauri commands + lib.rs wiring**  
  Register `fetch_market_data`, `run_strategy`, `run_backtest`. Await `init_db()` in setup (move from spawn). Add `async-trait`, `uuid` to Cargo.toml.  
  **Files**: `lib.rs` (M), `Cargo.toml` (M) | **Deps**: T01, T04, T06  
  **Accept**: `cargo build` succeeds; Tauri dev shows DB init before React mount | **M**

### Phase 3: React Shell (PR 3)

- [x] **T08 — Typed IPC bridge**  
  Created `src/lib/tauri.ts` with typed `invoke<>()` wrappers for greet, fetchMarketData, runStrategy, runBacktest. OHLCVBar, Signal, BacktestResult interfaces matching Rust serde models.  
  **Files**: `src/lib/tauri.ts` (C) | **Deps**: none  
  **Accept**: TypeScript compiles with zero errors | **S**

- [x] **T09 — Zustand stores**  
  Created `src/store/uiStore.ts` (theme, sidebarCollapsed, activeRoute + manual localStorage persistence) and `src/store/marketDataStore.ts` (cache, loading, errors, fetchData/getData/clearCache). Manual localStorage with try/catch for graceful degradation.  
  **Files**: `uiStore.ts` (C), `marketDataStore.ts` (C) | **Deps**: none  
  **Accept**: TypeScript compiles with zero errors | **M**

- [x] **T10 — Theme system**  
  Created `src/theme/theme.css` (CSS custom properties for light+dark: bg-primary/secondary/tertiary, text-primary/secondary, accent, border, spacing, shadows) and `src/theme/useTheme.ts` (hook reads from uiStore, applies `data-theme` attribute on documentElement, exposes toggleTheme).  
  **Files**: `theme.css` (C), `useTheme.ts` (C) | **Deps**: T09  
  **Accept**: TypeScript compiles with zero errors | **M**

- [x] **T11 — App Shell (Sidebar, TopBar, ContentArea, ErrorBoundary)**  
  Created `src/shell/layout.tsx` (flexbox Shell with TopBar + Sidebar + content area), `src/shell/sidebar.tsx` (240→64px collapsible nav, 5 routes, active highlight, collapse button), `src/shell/topbar.tsx` (app title, theme toggle, connection status), `src/shell/styles.css` (structural styles), `src/lib/errorBoundary.tsx` (class component with fallback + retry + onError). ContentArea uses activeRoute-based routing with ErrorBoundary wrapping per route.  
  **Files**: `layout.tsx` (C), `sidebar.tsx` (C), `topbar.tsx` (C), `errorBoundary.tsx` (C), `styles.css` (C) | **Deps**: T09, T10  
  **Accept**: All routes render, sidebar collapses, theme toggles | **L**

- [x] **T12 — Wire App.tsx + index.css + final integration**  
  Replaced placeholder App with `<Shell />` + `useTheme()`. Updated `index.css` to import theme.css, use CSS custom properties, add transition, box-sizing reset, scrollbar styling. Created `src/modules/dashboard.tsx` — dashboard placeholder with status indicator, stats grid (4 cards), and command quick actions.  
  **Files**: `App.tsx` (M), `index.css` (M), `dashboard.tsx` (C) | **Deps**: T08, T11  
  **Accept**: `tsc -b` zero errors, `vite build` succeeds | **S**

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Engine Core | 5 | T01–T05: BarCollection, strategies, backtest, risk |
| DB + Tauri | 2 | T06–T07: Repos, OnceCell, command wiring |
| React Shell | 5 | T08–T12: IPC, stores, theme, layout, integration |
| **Total** | **12** | **17 new files + 9 modified** |

## Implementation Order

1. **PR 1** — Engine Core (T01→T02→T03→T04→T05): pure Rust, no DB or UI needed
2. **PR 2** — DB + Wiring (T06→T07): repos can be tested with in-memory SQLite
3. **PR 3** — React Shell (T08→T09→T10→T11→T12): UI can be developed and tested independently
