# Design: Intermarket Module

## Architecture

```
src-tauri/src/analysis/          ← Nuevo: módulos de análisis (OCP)
├── mod.rs                       — AnalysisModule trait + ModuleContext
├── intermarket/
│   ├── mod.rs                   — IntermarketModule (impl AnalysisModule)
│   ├── cycle.rs                 — CyclePhase detection + transition matrix
│   └── ratios.rs                — KeyRatios calculation + trend detection
│
src/modules/
├── intermarket/
│   ├── index.tsx                — Main React component
│   ├── CycleIndicator.tsx       — Phase visualization
│   └── RatiosPanel.tsx          — Key ratios + signals

src/store/
└── analysisStore.ts             — New: stores for analysis results
```

## Rust Implementation Plan

### 1. AnalysisModule trait (analysis/mod.rs)
```rust
#[derive(Clone)]
pub struct DataRequirement {
    pub symbol: String,
    pub range: String,
    pub description: String,
}

pub struct ModuleContext {
    pub db: Pool<Sqlite>,
    pub market_data: MarketDataRepository,
}

#[async_trait]
pub trait AnalysisModule: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn requirements(&self) -> Vec<DataRequirement>;
    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>>;
}

#[async_trait]
pub trait ModuleOutput: Send + Sync {
    fn as_json(&self) -> Value;
    fn module_name(&self) -> &str;
}
```

### 2. Intermarket Data Flow

```
React: requests analysis
  → IPC: invoke("run_analysis", { module: "intermarket" })
  → Rust: IntermarketModule::analyze()
    → Fetch: SPY, TLT, DBC, DXY, XLF, XLE, XLV, XLK, XLI, XLP, XLY
    → Compute: returns(), rolling ratios, trends
    → Evaluate: cycle matrix → phase + confidence
    → Package: IntermarketReport
  → IPC: returns JSON
  → React: renders CycleIndicator + RatiosPanel
```

### 3. Cycle Detection Matrix

| Indicator | Expansion | Peak | Contraction | Trough |
|-----------|-----------|------|-------------|--------|
| Stock/Bond trend | Rising | Falling | Falling | Rising |
| Cyclical/Defensive | Rising | Peak→Falling | Falling | Trough→Rising |
| Commodity/Bond | Rising | High→Falling | Falling | Low→Rising |
| Dollar | Falling | Rising→Stable | Rising | Peak→Falling |

Transition rules:
- Must follow sequence: Contraction → Trough → Expansion → Peak → Contraction
- Exception: can skip Trough if V-shaped recovery (confidence penalty)
- Minimum stay: 2 months in any phase before transition

### 4. Files to create/modify

| File | Action |
|------|--------|
| `src-tauri/src/analysis/mod.rs` | Create — AnalysisModule trait, ModuleContext, ModuleOutput |
| `src-tauri/src/analysis/intermarket/mod.rs` | Create — IntermarketModule struct + analyze() |
| `src-tauri/src/analysis/intermarket/cycle.rs` | Create — CyclePhase enum, detection, transition matrix |
| `src-tauri/src/analysis/intermarket/ratios.rs` | Create — KeyRatios, trend calculation |
| `src-tauri/src-tauri/src/lib.rs` | Modify — add analysis module, register run_analysis command |
| `src/modules/intermarket/index.tsx` | Create — Main React component |
| `src/modules/intermarket/CycleIndicator.tsx` | Create — Phase visualization |
| `src/modules/intermarket/RatiosPanel.tsx` | Create — Ratios + indicators table |
| `src/store/analysisStore.ts` | Create — Zustand store for analysis results |
| `src/shell/layout.tsx` | Modify — add Intermarket route |
| `src/lib/tauri.ts` | Modify — add runAnalysis command |

## UI Design

```
┌──────────────────────────────────────────────┐
│  Intermarket Analysis                          │
│                                                │
│  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Cycle Phase  │  │  Key Ratios            │ │
│  │  ┌────────┐  │  │  Stock/Bond    ↑ 1.24  │ │
│  │  │  🌊    │  │  │  Cycl/Def      ↓ 0.87  │ │
│  │  │LATE EXP│  │  │  Comm/Bond     ↑ 1.52  │ │
│  │  │ 82%    │  │  │  Dollar Trend  ↓ -2.3% │ │
│  │  └────────┘  │  └────────────────────────┘ │
│  │  confianza    │                             │
│  └──────────────┘  ┌────────────────────────┐ │
│                     │  Indicators Detail      │ │
│                     │  ✅ SPY/TLT ↑ bullish   │ │
│                     │  ⚠️ XLF/XLP ↓ neutral  │ │
│                     │  ❌ DBC/TLT ↓ bearish  │ │
│                     └────────────────────────┘ │
└──────────────────────────────────────────────┘
```
