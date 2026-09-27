# Guía de Desarrollo 🛠️

Esta guía te ayudará a configurar y ejecutar el entorno de desarrollo de Ticker Tape en tu máquina local.

## 📋 Requisitos Previos

Asegúrate de tener instaladas las siguientes herramientas:
- **Rust**: Toolchain actualizado de Rust (`rustc`, `cargo`).
- **Node.js**: Entorno de ejecución de JavaScript (versión 18 o superior).
- **pnpm**: Gestor de dependencias (se debe ejecutar vía `corepack` en este proyecto).
- **Ollama (Opcional)**: Instalado y en ejecución (`localhost:11434`) si deseas probar las funcionalidades de Inteligencia Artificial locales.

## 🚀 Instalación y Ejecución

1. **Instalar Dependencias del Frontend**
   Dentro de la raíz del proyecto, instala las dependencias de Node:

   corepack pnpm install


2. **Levantar el Entorno de Desarrollo**
   Ejecuta el entorno completo (Vite + backend de Tauri):

   corepack pnpm tauri dev

   *Nota: La primera vez, Cargo tardará unos minutos en compilar las dependencias de Rust.*

3. **Construcción para Producción (Build)**
   Para verificar tipos y compilar el frontend, o para generar el binario final:

   # Compilación del Frontend (TypeScript + Vite)

   corepack pnpm run build
   
   # Construcción del Binario de la App (Tauri)

   corepack pnpm tauri build


## 🧪 Pruebas y Verificación (Testing & Quality)

El proyecto cuenta con verificación automatizada en ambos extremos de la arquitectura:

1. **Frontend (Vitest & TypeScript)**:

   # Ejecutar suite de pruebas unitarias/integración de React/TypeScript (60 tests)

   corepack pnpm test

   # Verificación de tipos en TypeScript

   npx tsc --noEmit


2. **Backend (Rust Cargo & Clippy)**:

   # Correr pruebas unitarias nativas de Rust (144 tests)

   cargo test --manifest-path src-tauri/Cargo.toml

   # Control de lints y calidad de código Rust sin advertencias
   
   cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings


## 🗂️ Estructura Clave de Archivos

- `/src/modules/`: Módulos principales divididos en subcomponentes (`dashboard/components/`, `portfolio/components/`).
- `/src/hooks/`: Hooks personalizados desacoplados (`usePortfolioCalculator`).
- `/src/components/ui/`: Primitivas de UI accesibles (Card, Button, Badge, ErrorBoundary) con tokens de elevación `variant="filled"`.
- `/src/styles/`: Estilos globales y clases institucionales (`.institutional-table`, `.cyber-card`).
- `/src-tauri`: Código Rust (trading engine, base de datos SQLite, Tauri IPC bridge).
- `AGENTS.md`: Guía y reglas de arquitectura para coordinación de agentes AI.
