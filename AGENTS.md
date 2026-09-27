# Ticker Tape · Agent Coordination

> **Single Source of Truth** para la coordinación de agentes.

---

## 1. Project Overview

| Atributo | Valor |
|----------|-------|
| **Nombre** | Ticker Tape |
| **Stack** | Rust (Tauri) + React 18 + TypeScript + Vite + Zustand + SQLite |
| **Core** | Rust — trading engine, cálculos, MCP server, Ollama integration |
| **Frontend** | React + TypeScript + lightweight-charts |
| **Database** | SQLite (local-first) → sync → PostgreSQL (homelab) |
| **AI Integration** | MCP Server (opencode) + Ollama (LLMs locales) |

### Estructura del Proyecto

```
ticker-tape/
├── src-tauri/           # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── lib.rs       # App setup & command handlers
│   │   ├── trading/     # Core trading engine (144 tests)
│   │   ├── db/          # Database layer (SQLite sqlx)
│   │   ├── mcp/         # MCP server
│   │   └── ollama/      # Ollama integration
│   ├── migrations/      # SQLite migrations
│   └── tauri.conf.json
├── src/                 # React frontend
│   ├── modules/         # Modular business domains
│   │   ├── dashboard/   # Dashboard & components (ActionDesk, ActiveSignals, EquityChart, etc.)
│   │   ├── portfolio/   # Portfolio ledger tabs (Overview, Cash, IOL, Binance, Accounting, TransactionModal)
│   │   └── ...          # TopDown, Intermarket, Topology, Backtesting
│   ├── hooks/           # Custom hooks (usePortfolioCalculator)
│   ├── store/           # Zustand 5 stores (uiStore, marketDataStore)
│   ├── lib/             # Shared math & utilities (vanTharp, formatters)
│   ├── components/ui/   # Design system primitives (Card variant="filled", Button, Badge, ErrorBoundary)
│   ├── styles/          # Institutional dark theme & .institutional-table rules
│   └── shell/           # App shell (Navigation & Layout)
├── .atl/                # SDD artifacts
└── AGENTS.md            # This file
```

---

## 2. SDD & Quality Verification Rules

```
proposal → spec → design → tasks → apply → verify → archive
```

| Fase | Descripción |
|------|-------------|
| `sdd-explore` | Investigación inicial de requerimientos |
| `sdd-propose` | Propuesta de cambio |
| `sdd-spec` | Especificación detallada + escenarios |
| `sdd-design` | Diseño técnico |
| `sdd-tasks` | Desglose en tareas de implementación |
| `sdd-apply` | Implementación con principios SOLID |
| `sdd-verify` | Verificación empírica (ver comandos abajo) |
| `sdd-archive` | Archivado del cambio completado |

### 🚨 Comandos Obligatorios de Verificación (Definition of Done)
Todo agente antes de declarar completada una tarea DEBE ejecutar y verificar:
1. `pnpm test` -> 100% verde en pruebas Vitest del frontend (60 tests).
2. `npx tsc --noEmit` -> 0 errores de compilación TypeScript.
3. `cargo test --manifest-path src-tauri/Cargo.toml` -> 100% verde en Rust backend (144 tests).
4. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` -> 0 lints/warnings.

---

## 3. Stack Reference

| Componente | Tecnología | Propósito |
|------------|-----------|-----------|
| Desktop Shell | Tauri v2 | App nativa cross-platform |
| Backend | Rust (edition 2024) | Trading engine, cálculos (144 tests) |
| Frontend | React 18 + TypeScript | UI modular con SOLID |
| UI Design System | CSS Elevation Tokens + JetBrains Mono | `.institutional-table` zebra striping, `variant="filled"` |
| Testing | Vitest + Cargo Test | 60 frontend tests + 144 Rust tests |
| State | Zustand 5 | Estado del frontend |
| Charts | lightweight-charts | Gráficos financieros |
| DB Local | SQLite (sqlx) | Almacenamiento local-first (WAL) |
| DB Cloud | PostgreSQL / Supabase | Sincronización y backup |
| MCP | Rust custom | Exponer tools a opencode |
| LLM | Ollama | LLMs locales para análisis |
| Package Manager | pnpm | Frontend dependencies |

---

*Última actualización: 2026-09-25*
