# Arquitectura del Sistema 🏗️

Ticker Tape utiliza una arquitectura de aplicación de escritorio moderna basada en **Tauri**, que combina un backend nativo de alto rendimiento con una interfaz de usuario web ágil.

## 🧩 Componentes Core

### 1. Frontend (Capa de Presentación UI)
La interfaz de usuario vive en el directorio `src/` y está diseñada de forma modular:
- **React 18 + TypeScript**: Asegura un tipado estricto desde la UI hasta las respuestas del backend.
- **Zustand**: Gestión global del estado separada en `uiStore` (temas, sidebar) y `marketDataStore` (caché de datos del mercado).
- **Lightweight Charts**: Motor de renderizado en canvas para gráficos financieros interactivos (velas japonesas, líneas, áreas, marcadores).
- **Arquitectura de Módulos**: Los módulos (ej. Backtesting, Monitor, Portfolio, Intermarket) actúan como widgets encapsulados inyectados en un `Shell` layout central.

### 2. Backend (Capa Lógica y Computacional)
Escrito enteramente en **Rust** (ubicado en `src-tauri/src/`):
- **Trading Engine**: Realiza cálculos de indicadores, fuerza relativa, estrategias y simulaciones de backtesting en hilos nativos para no bloquear la UI.
- **Tauri IPC Bridge**: Puente de comunicación seguro que expone comandos de Rust (`commands`) que pueden ser invocados asíncronamente desde TypeScript.
- **Cliente Ollama**: Módulo HTTP local (`mcp` y `ollama/mod.rs`) que se comunica con el daemon local de Ollama (en el puerto `11434`) para el análisis del mercado usando LLMs.

### 3. Capa de Datos (Almacenamiento)
- **SQLite (sqlx)**: Motor de base de datos *local-first* configurado con modo de escritura anticipada (WAL) para máxima concurrencia y persistencia sin servidores externos. Se proyecta su posterior sincronización con PostgreSQL para setups tipo *homelab*.

## 🔄 Flujo de Datos Típico (Ej. Backtesting)
1. **UI**: El usuario configura la estrategia en `BacktestingModule` y hace clic en "Ejecutar".
2. **IPC**: Se llama a la función `runStrategy()` de Tauri en TypeScript.
3. **Rust Engine**: Recibe el comando, procesa la serie temporal contra la lógica de la estrategia (ej. *Crossover de Medias Móviles*) en el backend.
4. **Respuesta**: Serializa el resultado (trades, KPIs, métricas) y lo devuelve a React para actualizar la vista y pintar la gráfica instantáneamente.
