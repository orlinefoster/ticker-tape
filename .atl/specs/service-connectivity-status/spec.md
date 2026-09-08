# Specification: Service Connectivity Status

This specification defines the requirements and scenarios for the service connectivity status feature in the Ticker Tape application.

## Requirement 1: Backend Service Health Check

The Rust backend MUST expose a Tauri command `check_services_status` to probe the connectivity of the SQLite Database, Ollama API, and Yahoo Finance API.

1. The probe operations MUST run asynchronously and concurrently.
2. The Ollama API and Yahoo Finance API connection checks MUST implement a strict timeout of 1.5 seconds.
3. The SQLite Database check MUST query the connection pool with a lightweight operation (e.g., `SELECT 1`).

### Scenario: DB, AI, and DATA are fully operational
- **Given** all backend services (SQLite Database, Ollama API, Yahoo Finance API) are online and responding within 1.5 seconds.
- **When** the `check_services_status` command is executed.
- **Then** the command MUST return a status payload showing all three services as connected/operational.

### Scenario: DB is operational, but AI is offline, and DATA connection times out
- **Given** the SQLite Database is online, the Ollama API is offline, and the Yahoo Finance API is unresponsive.
- **When** the `check_services_status` command is executed.
- **Then** the Ollama check MUST fail immediately, the Yahoo Finance check MUST timeout after 1.5 seconds, and the command MUST return a payload indicating SQLite is operational, but Ollama and Yahoo Finance are disconnected.

---

## Requirement 2: Frontend Status Polling and Store

The frontend MUST manage the connectivity state using a central Zustand store.

1. The store MUST track the status (`'connected' | 'mock' | 'disconnected'`) for `db`, `ai`, and `data`.
2. The store MUST poll the backend `check_services_status` command every 15 seconds.
3. The store MUST support a user override preference: `"Real"` (forces real backend check results), `"Mock"` (forces all services to mock state), and `"Auto"` (falls back dynamically to mock on failure, or connected on success).

### Scenario: User switches status override to Mock
- **Given** the frontend store is currently running in "Auto" mode with real connected services.
- **When** the user selects the "Mock" override mode.
- **Then** the store MUST immediately transition all service statuses to Mock state, bypass backend status updates, and update the UI accordingly.

---

## Requirement 3: Topbar Connectivity Indicators

The application topbar navigation MUST render three distinct status badges for the DB, AI, and DATA services.

1. The topbar MUST render a dropdown selector to allow users to toggle between override modes ("Real", "Mock", "Auto").
2. The badges MUST use the following color/symbol coding:
   - **Green / Checkmark (`✓`)**: Connected / Real state.
   - **Yellow / Tilde (`~`)**: Mock / Fallback state.
   - **Red / Cross (`✗`)**: Disconnected state.

### Scenario: Topbar badge rendering for mixed connectivity states
- **Given** the override mode is set to "Auto".
- **When** the backend check reports DB is operational, AI is disconnected, and DATA is disconnected.
- **Then** the topbar MUST render the DB badge as Green/Checkmark, the AI badge as Yellow/Tilde (mock fallback), and the DATA badge as Yellow/Tilde (mock fallback).
