# Proposal: Service Status Indicators

## Intent

Provide visual clarity of service connectivity (SQLite DB, Ollama, Yahoo Finance API) and mock fallbacks directly in the topbar header, replacing the single hardcoded connection indicator.

## Scope

### In Scope
- **Tauri Backend Commands**:
  - Implement a Tauri command `check_services_status` to query status of three key components:
    1. **SQLite Database**: Verify connection pool is initialized and responsive.
    2. **Ollama (AI)**: Probe local port 11434 (`/api/tags` or similar endpoint) with a short connect and request timeout.
    3. **Yahoo Finance (DATA)**: Probe external data provider endpoint with a short timeout.
  - Implement strict 1.5-second timeouts on external/network checks to prevent application blocking.
- **Frontend State Store**:
  - Create a new Zustand store `src/store/serviceStatusStore.ts` that manages the checked states (`'connected' | 'mock' | 'disconnected'`) and handles background polling (every 15 seconds).
  - Allow user configuration options (`"real" | "mock" | "auto"`) via the store to support forcing mock data or auto-fallbacks.
- **UI Indicators**:
  - Modify `src/shell/topbar.tsx` to display three separate connectivity badges: `DB` (Database), `AI` (Ollama), and `DATA` (Yahoo Finance / Market Data API).
  - Provide a visual legend/tooltips and a configuration dropdown to let users select active status modes.

### Out of Scope
- Auto-healing or automatically starting disconnected services (e.g. attempting to boot Ollama or repair SQLite DB file).
- Modifying actual core business logic inside analysis modules or strategies to use other alternate remote providers.
- Real-time event-driven pushes from Rust backend (Tokio background loops emitting Tauri events).

---

## Capabilities

### New Capabilities
| Capability | Description |
|------------|-------------|
| `service-connectivity-status` | Defines checking, state management, and display of connectivity status for SQLite database, local Ollama, and Yahoo Finance APIs, along with user-selected toggle behavior (Real, Mock, Auto). |

### Modified Capabilities
None.

---

## Approach

### Approach A: Frontend Polling Store with Rust Status Command
- **Rust Command Implementation**:
  - Expose `check_services_status` command in Tauri backend.
  - Perform the 3 checks in parallel/concurrently using `tokio::join!` or `tokio::spawn`.
  - Use `reqwest` client with a `connect_timeout` and general `timeout` of 1.5 seconds for Ollama and Yahoo Finance checks.
  - Query a simple check statement (e.g., `SELECT 1`) on the SQLite DB pool to verify responsiveness.
- **Frontend Zustand Store**:
  - Define `useServiceStatusStore` to hold connection status for `db`, `ai`, and `data` services.
  - Track user preference mode: `'real' | 'mock' | 'auto'`.
  - Provide `pollStatus` action which invokes `check_services_status` via Tauri IPC.
  - On store initialization/mount, run an immediate check, then schedule a periodic `setInterval` check every 15 seconds.
- **UI Enhancements in Topbar**:
  - Replace the existing single hardcoded connection dot in `src/shell/topbar.tsx`.
  - Render three distinct status indicators (badges or labels) using standard styling:
    - **Green (`🟢` or checkmark)**: Service is fully connected.
    - **Yellow (`🟡` or tilde `~`)**: Service is in Mock mode (either fallback because service is down, or user-forced).
    - **Red (`🔴` or cross `✗`)**: Service is offline/disconnected (with mock fallbacks disabled or unavailable).
  - Add tooltips to explain status detail (e.g. `Ollama offline, running with mock fallbacks`).
  - Introduce a settings dropdown menu to let users select their active mode configuration (`Real`, `Mock`, `Auto`).

---

## Affected Areas

| Area | Impact |
|------|--------|
| `src-tauri/src/lib.rs` | Declare and register Tauri command `check_services_status`. |
| `src-tauri/src/db/mod.rs` | Provide utility function to check DB pool viability (e.g. `SELECT 1` query). |
| `src-tauri/src/ollama/mod.rs` | Implement health probe for Ollama local API (timeout 1.5s). |
| `src-tauri/src/trading/market_data.rs` | Implement health probe for Yahoo Finance API (timeout 1.5s). |
| `src/store/serviceStatusStore.ts` (new) | Implement Zustand store for tracking state, user preference, and periodic polling. |
| `src/shell/topbar.tsx` | Modify TopBar to display status badges, tooltips, and mode dropdown. |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Network checks block Tauri main thread | Medium | Use asynchronous checks and set strict connect and request timeouts to 1.5 seconds on `reqwest` client calls. |
| DB locks or resource contention from polling | Low | Poll at a low frequency (15s) using a lightweight read-only query (`SELECT 1`). |
| Inaccurate mock state if user is offline | Low | Clarify via tooltips that offline triggers Mock mode fallback in auto/mock settings. |

---

## Rollback Plan

- Revert changes using Git: `git checkout HEAD -- <modified_files>`.
- Delete `src/store/serviceStatusStore.ts` if created.
- Revert Tauri command registry in `src-tauri/src/lib.rs`.

---

## Success Criteria

- [ ] `cargo build` compiles successfully without warnings.
- [ ] TopBar displays three distinct status indicators (DB, AI, DATA).
- [ ] Indicators correctly transition between states: Connected (Green), Mock (Yellow), and Disconnected (Red).
- [ ] Tooltips show detailed status descriptions for each backend service.
- [ ] User can change mode settings (Real, Mock, Auto) in the UI dropdown and the status badges adapt accordingly.
- [ ] Network failures on Ollama or Yahoo Finance are handled gracefully with a maximum 1.5s timeout, without crashing or freezing the UI.
