# Proposal: Ticker-Tape — Complete Trading System

## Intent

Build a local-first, production-grade automated trading desktop app with **Rust core**
handling all computation, **React/TypeScript frontend** for visualization,
**SQLite primary DB** with PostgreSQL sync, **MCP server** for opencode AI agent
integration, and **Ollama** for local LLM analysis. Port 10 analysis modules from
orlines-lab (React-only) to the Tauri Rust+React architecture.

## Scope

### In Scope

| # | Phase | Deliverables |
|---|-------|-------------|
| 1 | Foundation | Rust trading engine (OHLCV, backtesting, risk, signals), React shell + routing + IPC bridge, SQLite CRUD |
| 2a | Analysis — Core | Elliott Wave, Backtesting, Market Topology (3D/2D) |
| 2b | Analysis — Active | Relative Performance, Intermarket Analysis, Portfolio Management |
| 2c | Analysis — Simulation | Data Series Simulator, Portfolio Simulator, Monitor, Wiki |
| 3 | MCP Server | Full MCP JSON-RPC over stdio, exposing all trading tools to opencode |
| 4 | Ollama Pipeline | Local LLM for market context, pattern recognition, strategy reasoning |
| 5 | Sync Layer | SQLite → PostgreSQL incremental sync with conflict resolution |

### Out of Scope
- Real broker API integration (deferred to after Phase 4 validation)
- Multi-user / auth / collaboration features
- Real-time WebSocket streaming (polling-based for v1)
- Mobile app

## Capabilities

### New Capabilities
| Capability | Description |
|------------|-------------|
| `market-data-ingestion` | Fetch, cache, preprocess OHLCV from external APIs |
| `strategy-engine` | Pluggable Strategy trait — compose, evaluate, parameterize |
| `backtesting-engine` | Historical strategy eval with P&L curve, metrics |
| `signal-aggregation` | Multi-strategy fusion, consensus scoring, filtering |
| `risk-management` | VaR, Sharpe, max drawdown, position sizing |
| `elliott-wave-analysis` | Impulse/corrective wave detection + Fibonacci projections |
| `market-topology` | 3D/2D correlation graph of asset relationships |
| `relative-performance` | Relative Rotation Graph, cross-asset comparison |
| `intermarket-analysis` | Sector rotation, economic cycle, Dorsey matrix |
| `portfolio-management` | Positions, P&L, allocation, rebalance |
| `data-series-simulator` | Synthetic OHLCV generation for testing |
| `portfolio-simulator` | What-if scenarios, allocation optimization |
| `market-monitor` | Real-time dashboard, conditions, alerts |
| `mcp-server` | MCP JSON-RPC over stdio, tool definitions |
| `ollama-integration` | Local LLM for analysis and reasoning |
| `wiki-documentation` | Built-in module guides, fundamentals |
| `db-sync-layer` | SQLite → PostgreSQL incremental sync |

### Modified Capabilities
None — first proposal, no existing specs.

## Approach

1. **Rust as library core** (`ticker_tape_lib` cdylib). Strategy trait for pluggable
   strategies. Each analysis module = one Rust computation module + one React view.
2. **Tauri IPC bridge**: typed commands for every Rust operation, events for streaming.
3. **Module port**: each orlines-lab module → pure Rust math (ported TS → Rust) +
   React visualization (chart/data components with lightweight-charts).
4. **MCP server**: tokio task inside Tauri, stdio JSON-RPC, forwards to engine.
5. **Ollama**: `reqwest` HTTP to local Ollama, structured prompts, async with timeout.
6. **Sync**: `sync_log` table tracks mutations. CRDT-inspired merge for PostgreSQL push.

## Affected Areas

| Area | Impact |
|------|--------|
| `src-tauri/src/trading/` | Expand: backtesting, portfolio engine, performance metrics |
| `src-tauri/src/db/` | Add query repo pattern, sync module |
| `src-tauri/src/mcp/` | Full JSON-RPC server implementation |
| `src-tauri/src/ollama/` | Streaming, structured outputs, context management |
| `src-tauri/src/` (new) | `sync/`, `analysis/`, `broker/` (stub) |
| `src/modules/` (new) | 10 module directories, one per analysis type |
| `src/store/` (new) | Zustand stores per module + global |
| `src/shell/` (new) | Sidebar, layout, theme system |
| `src/components/` (new) | Shared chart, table, card components |
| `Cargo.toml` | Add `uuid`, `async-trait` |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| 10 modules too large for single phase | **High** | Split Phase 2 into 3 sub-phases (2a→2b→2c) |
| Tauri v2 API instability | Medium | Pin version, wrap IPC in agnostic commands |
| Ollama latency for real-time UX | Medium | Async with timeout, cached fallback, configurable model |
| SQLite write contention | Low | WAL mode, single writer pool |

## Rollback Plan

- Git tags at each phase boundary. Rollback = `git reset --hard <tag>`.
- sqlx migration versions. Rollback = revert to prior migration.
- Feature flags in `lib.rs` `run()` for each major module; disable individually.

## Dependencies

- **Rust**: tauri@2, sqlx@0.8 (sqlite+postgres), chrono, serde, tokio, reqwest, uuid, async-trait
- **JS**: react@18, zustand@5, lightweight-charts@4, @tauri-apps/api@2
- **External**: Ollama (local), Yahoo Finance / polygon.io, PostgreSQL (homelab)

## Success Criteria

- [ ] `cargo build` — zero warnings
- [ ] `pnpm tauri dev` — app launches with working shell navigation
- [ ] 1+ analysis module fully functional (Elliott Wave or Topology)
- [ ] DB initializes, migrations run, CRUD via Tauri commands
- [ ] MCP server returns `get_market_data` tool response
- [ ] Ollama `analyze_market_context` returns valid analysis text
- [ ] Backtest engine produces correct P&L for MA crossover strategy
