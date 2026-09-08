# Exploration: Service Connectivity & Mock Status Indicators

## Current State

1. **Mock vs Real State Handling**:
   - Currently, components such as `src/modules/chart/index.tsx`, `src/modules/monitor/index.tsx`, and `src/modules/relative_perf/index.tsx` invoke Tauri commands to fetch real data. 
   - If these commands fail (caught in a `catch` block), the components fall back to generating local mock data via helper functions like `generateMockBars` or `generateMockWaves`.
   - There is no central Zustand store or backend configuration that tracks service connectivity or governs whether mock data is active globally.
   - The Rust backend does not have a global "mock mode" configuration. It tries to initialize and query the database (stored in a global `OnceCell` in `src-tauri/src/db/mod.rs`) and queries Ollama (port `11434`) and Yahoo Finance via `reqwest` clients.

2. **Topbar Implementation**:
   - The TopBar component (`src/shell/topbar.tsx`) features a header displaying the app title/logo on the left, and a theme toggle button plus a hardcoded connection dot (`const connected = true;` rendering `🟢` or `🔴`) on the right.
   - The topbar is imported and rendered in the main shell layout (`src/shell/layout.tsx`).

---

## Affected Areas

1. **Backend (Tauri Commands)**:
   - Expose a new Tauri command (e.g., `get_services_status`) to probe database, Ollama, and market data provider connectivity.
   - Ensure the probe calls use short connection and response timeouts (e.g. 1.5–2 seconds) to avoid freezing the system if a service is unresponsive.

2. **Frontend (State Store)**:
   - Introduce a new Zustand store (e.g., `src/store/serviceStatusStore.ts`) to manage service states (`'connected' | 'mock' | 'disconnected'`) and handle periodic polling of the backend status.
   - Allow user configuration/toggles (e.g. `"real" | "mock" | "auto"`) to let users force mock mode or allow auto-fallbacks.

3. **Frontend (Shell Components)**:
   - Update `src/shell/topbar.tsx` to replace the single hardcoded dot with three status indicator icons or badges for:
     - **DB** (SQLite Database)
     - **AI** (Ollama LLM)
     - **Data** (Market Data / Yahoo Finance API)
   - Use clear color-coded states:
     - `🟢` / `✓` **Connected**: Real connection established and functioning.
     - `🟡` / `~` **Mock**: Fallback/mock mode is active (either because the service is offline or the user forced mock mode).
     - `🔴` / `✗` **Disconnected**: The service is down/offline and mock fallbacks are disabled or unavailable.

---

## Implementation Approaches

### Approach A: Frontend Polling Store with Rust Status Command (Recommended)
- **Description**: Add a `get_services_status` command in Rust that pings local SQLite, local Ollama port, and Yahoo Finance. Create a Zustand store `useServiceStatusStore` that runs a `setInterval` (e.g., every 15 seconds) to trigger this command and update UI indicators.
- **Pros**: Decoupled, simple to implement, handles user-forced mock settings easily, does not require complex multi-threaded event emission from Rust.
- **Cons**: Minor overhead of IPC polling, which is negligible for periodic status probes.

### Approach B: Rust Event-Driven Emitter
- **Description**: Spawn a background tokio thread in Tauri on startup that continuously checks service health and emits a `service-status-changed` event to the frontend only when status changes.
- **Pros**: Real-time status changes, zero polling overhead.
- **Cons**: Substantially more Rust logic required for thread spawning, lifecycle management, and clean shutdown.

### Approach C: Reactive Command-Based Status Tracking
- **Description**: Update the connection status reactively whenever actual data fetches succeed or fail.
- **Pros**: Zero polling or thread overhead.
- **Cons**: Indicators are stale/empty on app startup until the user performs actions that trigger the commands. Bad user experience.

---

## Recommendation

Implement **Approach A (Frontend Polling Store)**. It provides a simple, robust, and clean separation of concerns. 
- Create a `check_services_status` Rust command that probes the 3 resources.
- Create a `useServiceStatusStore` store that periodically polls this command.
- Update `src/shell/topbar.tsx` to read from this store and render three badges: `DB`, `AI`, and `DATA`, each with tooltips showing detail and a dropdown to let the user select preferred mode (e.g., "Force Mock" for local demoing).

---

## Risks

- **Network Blocking**: Querying external endpoints could block if there is a slow network or high packet loss. We must configure `reqwest` clients with short connect timeouts (e.g. 1.5 seconds) in the status check command.
- **SQLite Locks**: Periodic queries could theoretically cause database lock contention, but a read-only query like `SELECT 1` under SQLite WAL mode is extremely safe and lightweight.

---

## Ready for Proposal
**Yes**
