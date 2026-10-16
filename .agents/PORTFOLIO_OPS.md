# Protocolo de Operaciones y Gestión Asistida de Cartera (Minimal Tokens)

Este documento define las pautas para consultar, gestionar y rebalancear la cartera de **Ticker Tape** minimizando el consumo de tokens de contexto.

---

## 1. Reglas de Consulta Rápida (Zero Context Waste)

1. **Estado y Valuación Global**:
   - En lugar de inspeccionar múltiples archivos o stores de React, usar el endpoint compacto nativo `get_compact_portfolio_summary` o invocar `getCompactPortfolioReport()` en `src/lib/agentTools.ts`.
   - Devuelve un JSON sintetizado de < 200 tokens con la valuación total, desglose por broker y estado de la bóveda.

2. **Bóveda de Seguridad (Hardware-Grade AES-256-GCM + Argon2)**:
   - Toda información sensible (tenencias, transacciones, API keys y plan DCA) está protegida en SQLite en reposo.
   - Si `vault.isUnlocked === false`, se debe solicitar la clave/PIN maestro al usuario antes de emitir operaciones de modificación.

---

## 2. Estrategia Core-Satellite (SPY + Sectoriales DCA)

- **Núcleo (Core)**: SPY (S&P 500 Index ETF / CEDEAR SPY) — 50% a 80%.
- **Satélites (Sectores)**: XLK (Tech), XLF (Financiero), XLE (Energía), XLV (Salud), XLI (Industrial), XLC (Comunicaciones).
- **Algoritmo DCA Smart Rebalancing**:
  - Ubicación: [`src/modules/spy_dca/engine.ts`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/src/modules/spy_dca/engine.ts)
  - Prioriza compras únicamente sobre los activos **infraponderados (underweight)** para acercarlos al peso objetivo sin gatillar ventas gravables.

---

## 3. Resumen de Comandos Principales

| Acción | Comando / Endpoint | Payload Típico |
| :--- | :--- | :--- |
| **Consultar Bóveda** | `commands.vaultGetStatus()` | `{ is_initialized, is_unlocked, username }` |
| **Desbloquear Bóveda** | `commands.vaultUnlock(pin)` | `{ pin: "..." }` |
| **Guardar Plan DCA** | `commands.vaultSaveData("spy_dca_plan", json)` | Payload cifrado en reposo |
| **Calcular Compras Mes** | `calculateDcaRebalance(assets, config)` | Devuelve órdenes sugeridas exactas |
