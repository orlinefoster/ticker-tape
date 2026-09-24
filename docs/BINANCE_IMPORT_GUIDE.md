# Guía Operativa: Importación y Conciliación de Movimientos de Binance ⚡

Esta guía describe cómo bajar y procesar el historial de movimientos de tu cuenta de Binance para mantener conciliada la **Cartera Cripto** en **Ticker Tape**.

---

## 1. Cómo Exportar los Datos desde Binance

Binance ofrece dos formas estándar de exportar movimientos:

### Opción A: Historial de Trades (Trade History) - Recomendado
1. Ingresa a [Binance.com](https://www.binance.com/) con tu cuenta.
2. En la barra superior, ve a **Órdenes > Órdenes Spot > Historial de Transacciones (Trade History)**.
3. Haz clic en el botón superior derecho **Exportar Historial de Transacciones**.
4. Selecciona el rango de fechas (ej. últimos 3 meses, YTD) y haz clic en **Generar**.
5. Descarga el archivo `.csv`.

### Opción B: Historial de Depósitos / Extracciones (Transaction History)
1. Ve a **Billetera > Historial de Transacciones**.
2. Filtra por *Depósitos* o *Retiros*.
3. Exporta a formato `.csv`.

---

## 2. Cómo Importar en Ticker Tape

1. Abre **Ticker Tape** y ve a **Carteras & Patrimonio** (`/portfolio`).
2. Selecciona la pestaña **⚡ Binance Cripto**.
3. Haz clic en el botón verde **📥 Importar Trades / CSV**.
4. Abre el archivo CSV descargado de Binance con el bloc de notas, copia el contenido completo y pégalo en el cuadro de texto.
5. Haz clic en **Procesar y Conciliar**:
   - Ticker Tape calculará automáticamente las cantidades netas compradas/vendidas.
   - Ajustará el **precio promedio ponderado (PPP)** de cada moneda (BTC, ETH, SOL, Alts).
   - Generará los asientos contables en el **Historial de Operaciones**.
   - Descartará automáticamente las alertas pendientes de conciliar de la Torre de Control.

---

## 3. Función de Binance como Proveedor de Cotizaciones

El motor de Rust de Ticker Tape utiliza los endpoints públicos de Binance Klines (`https://api.binance.com/api/v3/klines`) para descargar velas diarias en tiempo real sin requerir claves API ni incurrir en costos.

Al analizar pares cripto (`BTC`, `ETH`, `SOL`), el sistema normaliza automáticamente el símbolo a `BTCUSDT`, `ETHUSDT` y consulta directamente a Binance.
