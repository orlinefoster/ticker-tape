# Tasks Breakdown: Service Status Indicator

## Workload Forecast Review
```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

- **Estimated changed lines:** 250-350 lines.

---

## Phase 1: Foundation (Backend commands and health checks)

- [x] **Task 1.1: Database viability check**
  - Implement a basic check function in [`src-tauri/src/db/mod.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/db/mod.rs) to verify the global SQLite database pool is initialized and responsive.
  - The function should query `SELECT 1` against the pool retrieved via `get_db()`.
  - **Signature:** `pub async fn ping_db() -> Result<()>` (or returning `bool`).

- [x] **Task 1.2: Ollama HTTP connectivity probe**
  - Add an HTTP connection probe function in [`src-tauri/src/ollama/mod.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/ollama/mod.rs).
  - Use `reqwest::Client` builder to configure a client with a strict `1.5-second` connection and request timeout.
  - Query `http://localhost:11434` (or `/api/tags` / equivalent check endpoint) with a `GET` request.
  - **Signature:** `pub async fn ping_ollama() -> bool` or similar.

- [x] **Task 1.3: Yahoo Finance connectivity probe**
  - Add a connectivity probe function for the market data provider in [`src-tauri/src/trading/market_data.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/trading/market_data.rs) (or a sub-helper inside [`src-tauri/src/trading/data_provider.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/trading/data_provider.rs)).
  - Perform a `GET` request using `reqwest::Client` with a strict `1.5-second` connection and request timeout targeting `https://query2.finance.yahoo.com`.
  - **Signature:** `pub async fn ping_yahoo_finance() -> bool`.

- [x] **Task 1.4: Implement and Register Tauri Command**
  - Implement `check_services_status` in [`src-tauri/src/lib.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/lib.rs).
  - Run all three checks concurrently using `tokio::join!` or `tokio::try_join!`.
  - Return a payload struct mapping to `ServicesStatus`: `{ db: bool, ai: bool, data: bool }`.
  - Add `check_services_status` to the `invoke_handler` list in `run()`.

---

## Phase 2: Frontend State (Zustand Store)

- [x] **Task 2.1: Add TypeScript interface for command result**
  - Update [`src/lib/tauri.ts`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src/lib/tauri.ts) to define the `checkServicesStatus` Tauri invocation wrapper.
  - Define interfaces:
    ```typescript
    export interface ServicesStatus {
      db: boolean;
      ai: boolean;
      data: boolean;
    }
    ```

- [x] **Task 2.2: Implement Zustand service status store**
  - Create the file [`src/store/serviceStatusStore.ts`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src/store/serviceStatusStore.ts).
  - Define types:
    - `ServiceStatus = 'connected' | 'mock' | 'disconnected'`
    - `OverrideSetting = 'Real' | 'Mock' | 'Auto'`
  - Implement state:
    - `status: { db: ServiceStatus; ai: ServiceStatus; data: ServiceStatus }`
    - `override: OverrideSetting`
  - Implement actions:
    - `setOverride(override: OverrideSetting)`: instantly sets override and updates status mapping.
    - `pollStatus()`: calls Tauri `check_services_status`.
      - If override is `'Mock'`, status is mapped to `{ db: 'mock', ai: 'mock', data: 'mock' }` directly without calling backend.
      - If override is `'Real'`, maps backend boolean response to `'connected'` or `'disconnected'`.
      - If override is `'Auto'`, maps backend boolean response to `'connected'` or `'mock'` (fallback).
  - Support persistence in `localStorage` for the selected `override` configuration.
  - Setup a background timer/scheduler (polling every 15 seconds) inside the store or initialized via shell hook.

---

## Phase 3: UI Implementation (Topbar Indicators and Toggle)

- [x] **Task 3.1: Modify TopBar UI**
  - Update [`src/shell/topbar.tsx`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src/shell/topbar.tsx).
  - Import `useServiceStatusStore`.
  - Remove the single hardcoded connection dot.
  - Render three distinct status indicators (badges/icons) labeled `DB`, `AI`, and `DATA`.
    - **Green / Checkmark (`✓`)**: Connected
    - **Yellow / Tilde (`~`)**: Mock / Fallback
    - **Red / Cross (`✗`)**: Disconnected
  - Add descriptive tooltips to each indicator.
  - Render a drop-down selector containing options: `"Real"`, `"Mock"`, `"Auto"` linked to `setOverride(override)`.

---

## Phase 4: Testing & Verification

- [x] **Task 4.1: Write backend tests**
  - Add Rust test cases in [`src-tauri/src/lib.rs`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src-tauri/src/lib.rs) or module-specific unit tests (e.g. mock check returns, network timeouts handling).

- [x] **Task 4.2: Write frontend unit tests**
  - Create the test file [`src/store/serviceStatusStore.test.ts`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src/store/serviceStatusStore.test.ts).
  - Test store state transitions when toggling override between `Real`, `Mock`, and `Auto`.
  - Mock Tauri IPC bridge invocation for `check_services_status` to verify correctly handling true/false payloads.
