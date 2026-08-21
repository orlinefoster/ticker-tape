# Ticker Tape - Quick Start 🚀

Esta es una guía rápida para levantar el entorno de desarrollo y evitar los problemas más comunes, especialmente en Linux.

## 1. Instalación Inicial

Asegúrate de tener instalados **Node.js** (v18+) y **Rust**. 
Instala las dependencias del proyecto usando `corepack`:

```bash
corepack pnpm install
```

---

## 2. Dependencias en Linux 🐧

Si estás en Linux, Tauri requiere las librerías de desarrollo de GTK y WebKit. 
En distribuciones basadas en Ubuntu/Debian, instálalas con:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```
*(Si no encuentra `4.1-dev`, prueba con `libwebkit2gtk-4.0-dev`).*

---

## 3. Ejecutar la Aplicación

### 🍎 Mac y 🪟 Windows
Normalmente, el comando estándar es suficiente para levantar el servidor Vite y compilar la ventana nativa de Rust:

```bash
corepack pnpm tauri dev
```

### 🐧 Linux (Wayland / Ubuntu)
En distribuciones modernas de Linux que utilizan **Wayland** como servidor gráfico, WebKitGTK puede sufrir un error fatal al intentar renderizar la ventana, lanzando el error: 
> `Error 71 (Protocol error) dispatching to Wayland display.`

Para prevenir este "crash", debes **forzar el backend X11 y deshabilitar el modo de composición de WebKit**. Ejecuta la aplicación utilizando este comando exacto:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 corepack pnpm tauri dev
```

---

## 4. Opcional: Probar solo el Frontend (Navegador)
Si no deseas compilar el motor de Rust y sólo necesitas ajustar estilos en la interfaz web, puedes levantar únicamente el frontend en tu navegador con:

```bash
corepack pnpm dev
```
*(Nota: Las funciones del motor de Backtesting y los comandos Tauri no funcionarán en este modo).*
