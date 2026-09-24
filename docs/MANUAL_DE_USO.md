# Ticker Tape - Manual Integral de Operaciones & Guía de Usuario 📖

Bienvenido a la documentación operativa de **Ticker Tape**. Este manual detalla la arquitectura, metodología y uso paso a paso de cada módulo de la terminal para que nunca te pierdas en el flujo de trabajo diario.

---

## 1. Filosofía & Principios de la Terminal

1. **Ciclo Operativo Cerrado:** En una mesa de dinero profesional, no existen herramientas aisladas. Cada indicador o señal debe conducir a una asignación de capital, una gestión de riesgo estricta y un registro patrimonial.
2. **Estética de Alta Densidad (16:9):** Inspirada en plataformas profesionales como *NinjaTrader 8*, *Bloomberg Terminal* y *Refinitiv Workspace*. Fondos en carbón mate (`#0A0C10`), tipografía monospace tabular para números y alineación estricta de decimales, sin colores estridentes ("UI-slop").
3. **Gestión de Riesgo Van Tharp:** Ninguna operación se abre a ojo. Cada trade se dimensiona en función de **1R (el capital arriesgado)** y la distancia técnica hacia el Stop Loss.

---

## 2. Mapa Completo de Módulos

```
TICKER TAPE (Terminal 16:9)
├── 📊 VISIÓN GENERAL
│   ├── Torre de Control (Dashboard Principal)
│   └── Carteras & Patrimonio (Cash + IOL + Binance)
├── 🧠 INTELIGENCIA DE MERCADO
│   ├── Top-Down Engine (Macro -> Sectores -> Activos)
│   ├── Gráfico Técnico (TradingView Lightweight Charts)
│   ├── Ciclo Intermarket (Bonos, Acciones, Commodities, Dólar)
│   ├── Topología & Regímenes (Correlaciones y Volatilidad)
│   ├── Alpha Rotation Radar (Gráficos RRG de rotación)
│   └── Elliott Wave (Conteo de Ondas y Oscilador)
└── ⚙️ SISTEMAS & VALIDACIÓN
    ├── Backtesting (Simulación de Estrategias sobre SQLite)
    ├── Proveedores & Sync (Binance, Yahoo, IOL MCP, Supabase Cloud)
    └── Monitor de Sistema (Health check y latencias)
```

---

## 3. Módulos al Detalle

### 📊 Torre de Control (Dashboard Principal - `/`)
Es la pantalla de inicio obligada al abrir la aplicación.
- **Top Ribbon Patrimonial:**
  - **Patrimonio Neto Total:** Valuación consolidada en USD y en pesos al tipo de cambio CCL del día.
  - **Distribución de Capital:** Porcentaje asignado a *Cash*, *IOL* y *Binance Cripto*.
  - **Riesgo por Divisa:** Desglose automático de exposición en `% USD directo`, `% ARS nominal` y `% USDT/Cripto`.
- **Panel Izquierdo (Evolución & Tenencias):**
  - **Equity Curve Interactiva:** Curva histórica de crecimiento del capital total con selector de período (`3M`, `6M`, `YTD`, `ALL`).
  - **Activos Principales:** Tabla compacta de las mayores posiciones con cantidad, valuación y PnL en tiempo real.
- **Panel Derecho (Acciones & Radar):**
  - **Bandeja de Acciones & Conciliación:** Alertas prioritarias (vencimientos de cauciones, operaciones pendientes de conciliar de Binance, tokens de API).
  - **Radar de Señales Activas:** Señales cuantitativas emitidas por los motores macro y técnicos, con botón directo para **📐 Calcular Posición (Van Tharp)** o abrir el gráfico.

---

### 💼 Carteras & Patrimonio (`/portfolio`)
Unifica los tres libros contables (*ledgers*) en una única vista modular:

1. **💵 Dinero & Cash:**
   - Cuentas corrientes y cajas de ahorro bancarias en ARS y USD.
   - Efectivo billete (reserva de liquidez física).
   - Cauciones bursátiles en BYMA a 1-7 días con control de TNA anualizada.
2. **🇦🇷 Cartera IOL (InvertirOnline BYMA):**
   - Acciones del Merval y títulos públicos soberanos/corporativos.
   - **CEDEARs:** Títulos extranjeros con cálculo automático del CCL implícito y ratios de conversión.
   - **Conector Oficial IOL MCP:** Botón para probar el handshake con `https://mcp.invertironline.com/` y sincronizar tenencias y saldos oficiales con 1 clic.
3. **⚡ Binance Cripto:**
   - Monedas spot (BTC, ETH, SOL, Alts) y stablecoins (USDT/FDUSD).
   - **Importador & Conciliador de CSV:** Botón para pegar o cargar el historial exportado de Binance. Reconcilia posiciones, recalcula el precio promedio ponderado (PPP) y genera los asientos contables automáticamente.
4. **📜 Historial Contable Unificado:**
   - Registro cronológico de compras, ventas, depósitos, extracciones, dividendos e intereses cobrados.

---

### 📐 Motor de Position Sizing Van Tharp (`src/lib/vanTharp.ts`)
Implementa las matemáticas de dimensionamiento de posición de Van Tharp:
- **Concepto de 1R:** El riesgo máximo que estás dispuesto a perder en una sola operación (por defecto 1% o 1.5% de tu patrimonio total).
  $$\text{Riesgo } 1R (\$) = \text{Equity Total} \times \left(\frac{\text{Riesgo } \%}{100}\right)$$
- **Fórmula de Tamaño de Posición:**
  $$\text{Cantidad a Comprar} = \frac{\text{Riesgo } 1R (\$)}{\text{Precio Entrada} - \text{Stop Loss}}$$
- **Control de Sobre-Asignación:** Si un stop loss es demasiado ajustado o el activo requiere más capital del disponible en la cartera, la calculadora muestra una advertencia de riesgo de concentración y bloquea la orden hasta calibrar el stop.
- **Ratio Riesgo/Beneficio ($R$-Multiple):** Calcula a cuántas $R$ de beneficio está el Target Profit (ej. si arriesgas $100 y buscas ganar $300, el trade tiene un potencial de $+3.0R$).

---

### 🧠 Motores Analíticos de Inteligencia de Mercado

#### 🎯 Top-Down Engine (`/top-down`)
- Aplica el análisis de arriba hacia abajo: **Macro Global -> Regímenes de Mercado -> Sectores Líderes -> Selección de Activos**.
- Genera reportes estructurados para el escritorio del operador.

#### 🔄 Ciclo Intermarket (`/intermarket`)
- Rastrea las relaciones de causa y efecto de John Murphy entre:
  - Bonos del Tesoro (Tasas de interés).
  - Commodities (Oro, Petróleo, Cobre).
  - Renta Variable (S&P 500, Nasdaq).
  - Dólar estadounidense (DXY).
- Identifica en qué fase del ciclo económico estamos (Expansión, Contracción, Inflación o Deflación).

#### 🔗 Topología & Regímenes (`/topology`)
- Matriz de correlaciones cruzadas en tiempo real entre índices, commodities y criptoactivos.
- Detección de clústeres de riesgo y cambios en la estructura de volatilidad.

#### 📡 Alpha Rotation Radar (`/relative-perf`)
- Cuadrantes RRG (Relative Rotation Graphs) inspirados en Julius de Kempenaer.
- Muestra qué activos están en cuadrante **Leading** (Líderes), **Weakening** (Debilitándose), **Lagging** (Rezagados) o **Improving** (Mejorando).

#### 🌊 Elliott Wave (`/elliott`)
- Conteo fractal de ondas de impulso (1-2-3-4-5) y correctivas (A-B-C).
- Oscilador de Elliott (5/35 MACD) para confirmar picos de onda 3 y divergencias de onda 5.

---

### ⚙️ Sistemas, Proveedores y Persistencia

#### 🔌 Proveedores & Sincronización (`/providers`)
- **Binance Provider:** Velas diarias públicas descargadas en tiempo real por el backend de Rust.
- **Yahoo Finance:** Cobertura de activos tradicionales estadounidenses y globales.
- **SQLite Local Cache:** Base de datos local persistida en modo WAL para alta velocidad de lectura.
- **Supabase Cloud Cache:** Base PostgreSQL compartida en la nube para sincronizar velas históricas y respaldar snapshots diarios del patrimonio neto.
- **InvertirOnline (IOL MCP):** Cliente oficial JSON-RPC 2.0 (`https://mcp.invertironline.com/`) para operar en BYMA.

---

## 4. El Día a Día del Operador (Paso a Paso)

```
PASO 1: Apertura (09:30 hs)
└── Entrar a la Torre de Control (Dashboard).
    ├── Verificar el Patrimonio Neto Total y el tipo de cambio CCL.
    └── Revisar la Bandeja de Acciones: ¿Hay movimientos de Binance por conciliar? ¿Vence una caución?

PASO 2: Radar de Inteligencia (10:00 - 11:00 hs)
└── Inspeccionar el Radar de Señales Activas en el Dashboard.
    ├── Si SPY o GGAL tienen señal BUY: abrir Gráfico Técnico para validar soportes.
    └── Verificar la rotación en Alpha Rotation o el régimen en Top-Down.

PASO 3: Ejecución & Position Sizing (11:00 - 15:00 hs)
└── En la señal elegida, presionar "📐 Position Size (Van Tharp)".
    ├── Definir el riesgo por trade (ej. 1% de la cuenta).
    ├── Confirmar el precio de entrada y colocar el Stop Loss técnico.
    ├── Comprobar que la cantidad recomendada no sobre-asigne la cartera.
    └── Presionar "⚡ Registrar Orden": se descuenta de liquidez y se crea la posición.

PASO 4: Cierre & Auditoría (17:00 hs)
└── Navegar a Carteras & Patrimonio (`/portfolio`).
    ├── Verificar que todas las operaciones del día estén en el Historial Contable.
    ├── Enviar Snapshot diario a Supabase Cloud para alimentar la curva de evolución.
```
