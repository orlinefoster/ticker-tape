# Spec: React Shell

> Phase 1 — Foundation
> Capability: `app-shell`

---

## Requirements

### REQ-SHL-01: App Shell Layout
The app MUST render a persistent layout consisting of:
- **Sidebar** (left, 240px, collapsible): navigation links to modules
- **Top bar** (header): app title, theme toggle, connection status indicator
- **Content area**: renders the active module/route
- **Footer** (optional): status bar with clock, last sync timestamp

### REQ-SHL-02: Routing
Route definitions via a simple router (no react-router needed for v1 — use state-based routing):
- `/` → Landing / Dashboard placeholder
- `/backtesting` → Backtesting module
- `/elliott` → Elliott Wave module
- `/topology` → Market Topology module
- `/portfolio` → Portfolio module
- `/monitor` → Market Monitor
- `/wiki` → Wiki / Documentation
- Route state managed in Zustand `useUIStore`

### REQ-SHL-03: Sidebar Navigation
Sidebar must:
- List all available modules with icons (unicode or SVG)
- Highlight active route
- Collapse to icon-only mode (64px) with a toggle button
- Persist collapsed state in localStorage

### REQ-SHL-04: Theme System
Theme system must support:
- Two themes: `light` (default) and `dark`
- CSS custom properties in `theme.css` for: colors, spacing, typography, border-radius, shadows
- Theme toggle in the top bar
- Persist theme preference in localStorage
- Smooth transition on theme switch (`transition: background-color 0.3s`)

### REQ-SHL-05: Zustand Stores

**useUIStore:**
- `sidebarCollapsed: boolean`
- `theme: 'light' | 'dark'`
- `activeRoute: string`
- `toggleSidebar()`, `setTheme()`, `setActiveRoute()`

**useMarketDataStore:**
- `cache: Map<string, OHLCVBar[]>`
- `loading: Set<string>`
- `errors: Map<string, string>`
- `fetchData(symbol, range) -> Promise<void>` — calls Tauri IPC
- `getData(symbol) -> OHLCVBar[] | null`

### REQ-SHL-06: Tauri IPC Bridge
Tauri commands MUST be defined in Rust and callable from React:
- `greet(name: String) -> String` — health check
- `fetch_market_data(symbol: String, range: String) -> Result<Vec<OHLCVBar>, String>` — fetch from DB or external API
- `run_strategy(symbol: String, strategy: String, params: Value) -> Result<Vec<Signal>, String>` — run strategy
- `run_backtest(symbol: String, strategy: String, params: Value) -> Result<BacktestResult, String>` — run backtest

React-side:
- All Tauri calls wrapped in a `useTauriCommand` hook that handles loading/error states
- Commands return typed results (not `any`)

### REQ-SHL-07: Error Boundaries
- Top-level `<ErrorBoundary>` wrapping the entire app
- Per-module error boundaries for graceful isolation
- Fallback UI: "Something went wrong in [Module]. [Retry]"

### REQ-SHL-08: Loading States
- Skeleton screens for module loading
- Spinner for Tauri IPC calls
- Debounced loading indicator (200ms delay to avoid flicker)

---

## Scenarios

### Happy Path: App Launch
1. User launches app → sidebar visible, dashboard shown, theme=light
2. User clicks "Backtesting" in sidebar → route changes, content area loads BacktestingModule
3. User clicks theme toggle → all UI elements switch to dark theme
4. Preference persisted → next launch shows dark theme

### Happy Path: IPC Call
1. User types "SPY" in search → `fetch_market_data("SPY", "1y")` called
2. Zustand store shows `loading = {"SPY"}`
3. Rust returns data → store updates `cache`, `loading` clears
4. UI renders chart with data

### Error Path: IPC Failure
1. Network down → `fetch_market_data` returns error
2. `useMarketDataStore` captures error in `errors` map
3. UI shows retry button with error message
4. No crash, no blank screen

### Edge Case: Sidebar Collapse
1. User collapses sidebar → state persists in localStorage
2. User refreshes page → sidebar remains collapsed
3. User expands → returns to normal

---

## Acceptance Criteria

- [ ] App launches without errors (no console errors)
- [ ] Sidebar navigation works for all routes
- [ ] Theme toggle switches light↔dark with smooth transition
- [ ] Zustand stores are typed and initialized correctly
- [ ] `greet` Tauri IPC call returns correct response
- [ ] Error boundary catches thrown errors without crashing the app
- [ ] localStorage persistence works for theme + sidebar state
- [ ] Lighthouse performance: no layout shifts
