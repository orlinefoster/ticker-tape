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
├── src-tauri/           # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── lib.rs       # App setup
│   │   ├── trading/     # Core trading engine
│   │   ├── db/          # Database layer
│   │   ├── mcp/         # MCP server
│   │   └── ollama/      # Ollama integration
│   ├── migrations/      # SQLite migrations
│   └── tauri.conf.json
├── src/                 # React frontend
│   ├── modules/         # Analysis modules (like orlines-lab)
│   ├── store/           # Zustand stores
│   ├── lib/             # Shared utilities
│   ├── components/      # Shared components
│   └── shell/           # App shell (nav, layout)
├── .atl/                # SDD artifacts
└── AGENTS.md            # This file
```

---

## 2. SDD Workflow

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
| `sdd-apply` | Implementación |
| `sdd-verify` | Verificación contra spec |
| `sdd-archive` | Archivado del cambio completado |

---

## 3. Stack Reference

| Componente | Tecnología | Propósito |
|------------|-----------|-----------|
| Desktop Shell | Tauri v2 | App nativa cross-platform |
| Backend | Rust (edition 2024) | Trading engine, cálculos |
| Frontend | React 18 + TypeScript | UI |
| State | Zustand 5 | Estado del frontend |
| Charts | lightweight-charts | Gráficos financieros |
| DB Local | SQLite (sqlx) | Almacenamiento local-first |
| DB Cloud | PostgreSQL | Sincronización (homelab) |
| MCP | Rust custom | Exponer tools a opencode |
| LLM | Ollama | LLMs locales para análisis |
| Package Manager | pnpm | Frontend dependencies |

---

*Última actualización: 2026-06-19*
