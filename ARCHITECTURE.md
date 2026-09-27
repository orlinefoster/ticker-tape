# Arquitectura del Sistema 🏗️

Ticker Tape utiliza una arquitectura de aplicación de escritorio moderna basada en **Tauri**, que combina un backend nativo de alto rendimiento con una interfaz de usuario web ágil.

## 🧩 Componentes Core

### 1. Frontend (Capa de Presentación UI)
La interfaz de usuario vive en el directorio `src/` y está diseñada con una arquitectura modular orientada a dominios de negocio:
- **React 18 + TypeScript**: Tipado estricto extremo desde componentes UI hasta DTOs de comandos IPC de Tauri.
- **Arquitectura de Módulos & Componentes Encapsulados**:
  - `src/modules/dashboard/components/`: Subcomponentes especializados (`ActionDesk`, `ActiveSignals`, `EquityChart`, `PortfolioDistribution`, `AssetSummary`) extraídos para mantener responsabilidad única (SOLID).
  - `src/modules/portfolio/components/`: Pestañas ledger independientes (`PortfolioOverviewTab`, `CashLedgerTab`, `IolLedgerTab`, `BinanceLedgerTab`, `AccountingHistoryTab`, `TransactionModal`).
- **Hook Layer (`usePortfolioCalculator`)**: Hook personalizado para desacoplar el cálculo patrimonial consolidado, conversiones multimoneda (USD/ARS/USDT) y Van Tharp position sizing de la capa de renderizado UI.
- **Sistema de Diseño e Identidad Visual**:
  - **Elevación de Contenedores (`variant="filled"`)**: Uso de variables CSS dinámicas (`--bg-surface-elevated`) para paneles sutilmente rellenos en la Torre de Control y vistas secundarias, mejorando la jerarquía visual sin saturación.
  - **Tablas Financieras Institucionales (`.institutional-table`)**: Tablas de alta densidad con zebra striping alternado, cabeceras *sticky*, tipografía `JetBrains Mono` tabular y resaltado condicional neutro (`.row-bullish`, `.row-bearish`).
- **Zustand 5**: Gestión global de estado separada en `uiStore` (temas, elevación) y `marketDataStore` (caché de cotizaciones).
- **Lightweight Charts**: Motor de canvas de alto rendimiento para series temporales financieras.

### 2. Backend (Capa Lógica y Computacional)
Escrito enteramente en **Rust** (ubicado en `src-tauri/src/`):
- **Trading Engine**: Realiza cálculos de indicadores, fuerza relativa, estrategias y simulaciones de backtesting en hilos nativos para no bloquear la UI. Cobertura de 144 unit tests nativos.
- **Tauri IPC Bridge**: Puente de comunicación seguro que expone comandos de Rust (`commands`) que pueden ser invocados asíncronamente desde TypeScript.
- **Cliente Ollama**: Módulo HTTP local (`mcp` y `ollama/mod.rs`) que se comunica con el daemon local de Ollama (puerto `11434`) para análisis técnico/fundamental.

### 3. Capa de Datos & Persistencia
- **SQLite (sqlx)**: Motor de base de datos *local-first* configurado con modo de escritura anticipada (WAL) para máxima concurrencia y persistencia de transacciones e historial contable.
- **Supabase Cloud**: Conector remoto opcional para sincronización de snapshots patrimoniales y repositorio compartido de velas históricas.

## 🧪 Estrategia de Verificación y Pruebas
- **Frontend (Vitest)**: Suite de 60 tests distribuidos en 15 archivos `.test.ts(x)` cubriendo hooks (`usePortfolioCalculator`), stores, formateadores y validación de UI.
- **Backend (Cargo Test & Clippy)**: 144 tests unitarios en Rust probando motores de trading e IPC, validados con `cargo clippy --all-targets -- -D warnings`.

## 🔄 Flujo de Datos Típico (Ej. Backtesting)
1. **UI**: El usuario configura la estrategia en `BacktestingModule` y hace clic en "Ejecutar".
2. **IPC**: Se llama a la función `runStrategy()` de Tauri en TypeScript.
3. **Rust Engine**: Recibe el comando, procesa la serie temporal contra la lógica de la estrategia (ej. *Crossover de Medias Móviles*) en el backend.
4. **Respuesta**: Serializa el resultado (trades, KPIs, métricas) y lo devuelve a React para actualizar la vista y pintar la gráfica instantáneamente.
