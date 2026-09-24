# Ticker Tape - Manual del Ciclo Operativo y Control de Carteras 📊

Este documento describe la arquitectura operativa de **Ticker Tape**, diseñada como una terminal financiera sobria de alta densidad para pantallas 16:9 (estilo Bloomberg / NinjaTrader / Reuters).

---

## 1. El Enfoque del Negocio: El Ciclo Operativo Cerrado

En lugar de tener herramientas dispersas sin destino operativo, cada módulo cumple una función dentro de un ciclo continuo de 4 pasos:

```
┌────────────────────────────────────────────────────────┐
│ 1. RADAR & SEÑALES (Top-Down / Intermarket / Topology) │
│    Detecta regímenes de mercado y sectores líderes     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. ASIGNACIÓN & RIESGO (Money Management)             │
│    ¿Dónde está la liquidez? ¿Qué cartera fondear?     │
│    Control de riesgo cambiario (ARS vs USD vs BTC)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. REGISTRO & EJECUCIÓN                                │
│    - IOL: Integración vía MCP oficial (mcp.invertironline)│
│    - Binance: Sync de movimientos/trades + cotizaciones │
│    - Cash: Conciliación de cauciones y saldos bancarios│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. CONCILIACIÓN & EVOLUCIÓN (Torre de Control 16:9)    │
│    Seguimiento del Patrimonio Neto Total y PnL         │
│    Persistencia y centralización en Supabase Cloud     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Las Tres Carteras Consolidadas

El patrimonio total del operador se distribuye en tres libros contables (*ledgers*):

### 💵 1. Dinero / Cash & Liquidez Inmediata
- **Objetivo:** Preservar capital líquido para aprovechar oportunidades sin asumir riesgo de mercado.
- **Instrumentos:**
  - Cuentas corrientes y cajas de ahorro bancarias en ARS y USD.
  - Efectivo billete (reserva física).
  - Cauciones bursátiles BYMA a 1-7 días (con control de TNA anualizada) y fondos Money Market.
- **Riesgo:** Inflación en ARS / Tasa real.

### 🇦🇷 2. Cartera IOL (InvertirOnline BYMA)
- **Objetivo:** Operatoria de renta variable local, CEDEARs de empresas internacionales y deuda soberana/corporativa.
- **Instrumentos:**
  - **CEDEARs:** Con ratio de conversión y tipo de cambio implícito (CCL).
  - **Acciones Merval:** Renta variable argentina en pesos.
  - **Bonos Soberanos & Obligaciones Negociables (ONs):** Renta fija en dólares y moneda local.
- **Conector Oficial:** Conexión lista para el protocolo MCP oficial de InvertirOnline:
  - `https://mcp.invertironline.com/`

### ⚡ 3. Cartera Cripto (Binance)
- **Objetivo:** Exposición a activos digitales de alta volatilidad y tenencia de liquidez en stablecoins (USDT/FDUSD).
- **Instrumentos:**
  - Criptomonedas spot (BTC, ETH, SOL, altcoins).
  - Dólares digitales / Stablecoins en billetera spot/earn.
- **Doble Función:** Además de cartera, el backend de Rust utiliza la API de Binance (`api.binance.com/api/v3`) como proveedor nativo de velas diarias de mercado en tiempo real.

---

## 3. Pantalla Principal: Torre de Control 16:9

El Dashboard principal está optimizado para monitores panorámicos de alta resolución y se organiza en:

1. **Top Ribbon de Patrimonio:**
   - **Patrimonio Neto Total:** Valuado en USD y convertido a ARS según el CCL en tiempo real.
   - **Barra de Distribución de Capital:** `% Cash` | `% IOL` | `% Cripto`.
   - **Métricas de Exposición Cambiaria:** `% en USD directo`, `% en ARS`, `% en USDT`.
2. **Panel Central Izquierdo (Evolución & Tenencias):**
   - **Curva de Patrimonio (Equity Curve):** Gráfico interactivo con selector de período (`3M`, `6M`, `YTD`, `ALL`).
   - **Tabla de Tenencias Clave:** Activos más relevantes ordenados por capitalización y último rendimiento porcentual.
3. **Panel Central Derecho (Acciones & Inteligencia):**
   - **Bandeja de Acciones & Conciliación (Action Desk):** Alertas proactivas como movimientos pendientes de Binance, vencimientos de cauciones o sincronización de tokens.
   - **Radar de Señales Activas:** Oportunidades tácticas detectadas por el motor macro (Top-Down, Intermarket y Topology) con botón directo para abrir el gráfico.

---

## 4. Supabase Cloud: Centralización y Optimización de Consultas

Para evitar bloqueos por límite de peticiones (Yahoo Finance ~200 req/min, límites de rate en Binance e IOL):
- Las velas descargadas se escriben en la tabla compartida `market_candles` de Supabase.
- Al cargar gráficos o ejecutar backtests, la app consulta primero la base local en SQLite y luego la nube en Supabase antes de recurrir a las APIs externas.
- Los snapshots diarios de patrimonio (`portfolio_snapshots`) se respaldan en la nube para auditoría a largo plazo.

---

## 5. Diseño e Identidad Visual (Bloomberg / NinjaTrader Dark)

- **Canvas & Paneles:** Fondo carbón mate (`#0A0C10` y `#11141D`), bordes sutiles en `#232838`.
- **Tipografía:** Números financieros en **monospace tabular** (`JetBrains Mono`), garantizando alineación visual estricta de decimales y precios.
- **Color Funcional:**
  - Verde institucional (`#10B981`) para balances positivos y señales de compra.
  - Rojo sobrio (`#EF4444`) para caídas y ventas.
  - Ámbar (`#F59E0B`) para advertencias y vencimientos.
  - Azul técnico (`#3B82F6`) para selecciones y foco.
