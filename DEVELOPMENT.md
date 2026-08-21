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
   ```bash
   corepack pnpm install
   ```

2. **Levantar el Entorno de Desarrollo**
   Ejecuta el entorno completo (Vite + backend de Tauri):
   ```bash
   corepack pnpm tauri dev
   ```
   *Nota: La primera vez, Cargo tardará unos minutos en compilar las dependencias de Rust.*

3. **Construcción para Producción (Build)**
   Para verificar tipos y compilar el frontend, o para generar el binario final:
   ```bash
   # Compilación del Frontend (TypeScript + Vite)
   corepack pnpm run build
   
   # Construcción del Binario de la App (Tauri)
   corepack pnpm tauri build
   ```

## 🧪 Pruebas (Testing)

El frontend incluye pruebas unitarias y de integración utilizando **Vitest**.
Para correr la suite de pruebas (que cubre los stores y wrappers de IPC):
```bash
corepack pnpm test
```

## 🗂️ Estructura Clave de Archivos
- `/src`: Todo el código de React/TypeScript (Frontend).
- `/src-tauri`: Código Rust, configuraciones de Tauri (`tauri.conf.json`) y base de datos SQLite.
- `AGENTS.md`: Documento fundamental de coordinación para flujos SDD y gobierno de IA.
