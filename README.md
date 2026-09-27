# Ticker Tape 📈

Ticker Tape es una plataforma de análisis de mercado, backtesting y gestión de portafolio de escritorio. Está construida con un fuerte enfoque en el rendimiento, un modelo de funcionamiento "local-first" y capacidades avanzadas potenciadas por Inteligencia Artificial mediante modelos locales.

## 🚀 Características Principales

- **Monitor de Mercado en Vivo**: Scanner multi-activo con indicadores técnicos en tiempo real (RSI, Crossovers de Medias Móviles) y generación de señales de consenso.
- **Motor de Backtesting**: Simulación de estrategias comerciales históricas (MA Crossover, Bollinger, RSI) con visualización gráfica de la Curva de Capital (Equity Curve) y KPIs (Sharpe, Drawdown).
- **Análisis Técnico y Topológico**: Gráficos interactivos de alto rendimiento usando *lightweight-charts*, proyecciones de Ondas de Elliott, Fuerza Relativa (Relative Performance) y análisis intermercado.
- **Inteligencia Artificial Integrada**: Análisis contextual del mercado asistido por LLMs locales utilizando **Ollama**, garantizando privacidad y baja latencia.
- **Gestor de Portafolio**: Control detallado de posiciones, balance de caja, P&L no realizado y simulación de asignación de activos.

## 💻 Tech Stack & Arquitectura

- **Aplicación de Escritorio**: [Tauri v2](https://v2.tauri.app/)
- **Backend**: Rust (Engine de trading, cliente MCP, base de datos) con 144 unit tests nativos.
- **Frontend**: React 18, TypeScript, Vite, Vitest (60 tests unitarios e integración).
- **Diseño & UI**: Design system financiero de alta densidad, jerarquía de elevación de contenedores (`variant="filled"`), tablas institucionales zebra-striped (`.institutional-table`) y temas de alto contraste WCAG 2.2 AA.
- **Estado UI/Data**: Zustand 5 + Custom Hooks (`usePortfolioCalculator`)
- **Gráficos**: Lightweight Charts
- **Base de Datos**: SQLite (Local-first, WAL mode)
- **AI Integration**: Ollama + Modelos Locales

---
*Desarrollado para traders cuantitativos e inversores que buscan control total de sus datos y algoritmos.*
