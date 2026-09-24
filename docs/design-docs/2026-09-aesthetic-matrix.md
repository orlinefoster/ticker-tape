# Design Doc: Aesthetic Matrix & Retrofuturistic Dark Kawaii Design System

* **Author**: Senior Architect & UI Lead
* **Status**: Approved / In Implementation
* **Target Release**: Ticker Tape v0.2.0

---

## 1. Context & Scope

### 1.1 Problem Statement
El sistema visual previo utilizaba variables CSS mínimas (`--bg-primary`, `--accent`) con estilos fragmentados en línea (`style={{ ... }}`), lo que generaba inconsistencias de contraste, falta de identidad visual y dificultad para escalar nuevos módulos (charts, backtesting, topología).

### 1.2 Goals
* **Identidad Coherente**: Definir una matriz estética inspirada en el **Retrofuturismo Cyberpunk + Dark Kawaii** (fondos obsidiana profundos, acentos neón sakura/pastel, lavanda eléctrica y cian láser).
* **Control Centralizado de Tokens**: Tokenizar 100% de la UI (superficies, bordes, tipografía, estados de trading, glassmorphism y glows).
* **Atomic Components**: Estandarizar componentes base (`Card`, `Badge`, `Button`, `StatMetric`, `Table`, `Tabs`, `GlowContainer`).
* **Sincronización con Gráficos**: Integrar la paleta en los temas de *Lightweight Charts* y *TradingView mirrors*.

### 1.3 Non-Goals
* No cambiar la arquitectura de routing ni los contratos IPC con Rust.
* No saturar la UI con animaciones pesadas que degraden el rendimiento (mantener 60 FPS fijos).

---

## 2. Paleta & Design Tokens: *Cyber-Sakura Noir*

### 2.1 Superficies & Canvas (Deep Obsidian Matrix)
| Token | Hex / Valor | Uso |
| :--- | :--- | :--- |
| `--bg-canvas` | `#0B0D17` | Fondo raíz de la ventana (vacío cósmico) |
| `--bg-surface` | `#121526` | Fondo de Sidebar, TopBar y contenedores principales |
| `--bg-surface-card` | `#191D32` | Tarjetas, paneles de módulos y tablas |
| `--bg-surface-glass` | `rgba(25, 29, 50, 0.75)` | Paneles flotantes con `backdrop-filter: blur(12px)` |
| `--border-subtle` | `rgba(255, 107, 157, 0.14)` | Bordes sutiles con tinte Sakura |
| `--border-glow` | `rgba(255, 107, 157, 0.40)` | Bordes activos o hover con glow |

### 2.2 Acentos Dark Kawaii & Retrofuturistas
| Token | Hex / Valor | Semántica |
| :--- | :--- | :--- |
| `--accent-sakura` | `#FF6B9D` | **Primario**: Botones principales, branding, highlights clave |
| `--accent-sakura-soft` | `#FFA3C1` | **Pastel**: Pills, tags secundarios, badges suaves |
| `--accent-lavender` | `#B388FF` | **IA / Algoritmos**: Ollama, Elliott Waves, Topología |
| `--accent-mint` | `#00F5D4` | **Activo / Live**: Latencia baja, conexión OK, status activo |
| `--accent-peach` | `#FFE082` | **Warning / Intermedio**: Avisos, advertencias de riesgo |

### 2.3 Matriz de Trading & Señales
| Token | Hex / Valor | Semántica |
| :--- | :--- | :--- |
| `--signal-bullish` | `#00F5A0` | **Compra / Vela Verde**: Neo-Mint eléctrico |
| `--signal-bearish` | `#FF3366` | **Venta / Vela Roja**: Cyber Coral/Ruby |
| `--signal-neutral` | `#8C93B5` | **Neutro / Hold**: Lavanda grisáceo |

### 2.4 Efectos Retrofuturistas (Glows & CRT Scanlines)
* `--glow-sakura`: `0 0 16px rgba(255, 107, 157, 0.25)`
* `--glow-mint`: `0 0 16px rgba(0, 245, 212, 0.25)`
* `--glow-lavender`: `0 0 16px rgba(179, 136, 255, 0.25)`
