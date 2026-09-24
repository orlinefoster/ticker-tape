# Guía de Integración: InvertirOnline (IOL) Model Context Protocol (MCP) 🔌

Esta guía detalla la integración de **Ticker Tape** con el servidor oficial MCP de InvertirOnline:
- **Endpoint oficial:** `https://mcp.invertironline.com/`
- **Protocolo:** JSON-RPC 2.0 sobre Server-Sent Events (SSE) / HTTP POST.

---

## 1. ¿Qué es el MCP de InvertirOnline?

El Model Context Protocol (MCP) es un estándar abierto que permite a asistentes y aplicaciones conectarse de forma segura a servicios externos mediante un catálogo de **Herramientas (Tools)** y **Recursos (Resources)**.

IOL provee este servidor oficial para que clientes autenticados puedan:
1. Consultar saldos disponibles y totales en pesos argentinos (ARS) y dólares (USD).
2. Obtener el portafolio consolidado en tiempo real (CEDEARs, acciones del Merval, bonos soberanos y obligaciones negociables).
3. Obtener cotizaciones de mercado de BYMA con latencia mínima.
4. Operar órdenes de compra y venta de activos locales e internacionales.

---

## 2. Herramientas MCP Soportadas

| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `iol_get_cuenta` | `{}` | Devuelve saldo disponible en ARS, disponible en USD y total valorizado. |
| `iol_get_portafolio` | `{ pais: "argentina" \| "estados_unidos" }` | Devuelve tenencias de títulos, precio promedio ponderado, último precio y PnL. |
| `iol_get_cotizacion` | `{ simbolo: "SPY", mercado: "bcba" }` | Cotización de mercado, variación diaria y volumen operado. |
| `iol_get_operaciones` | `{ estado: "ejecutadas" \| "pendientes" }` | Historial de transacciones de la cuenta comitente. |
| `iol_comprar` | `{ simbolo, cantidad, precio, tipo: "Limite" }` | Envío de orden de compra a mercado con confirmación previa. |

---

## 3. Cómo Conectar en Ticker Tape

1. Abre la aplicación de escritorio y navega a **Proveedores & Sync** (`/providers`).
2. En la tarjeta **InvertirOnline (IOL MCP)**, verifica el estado del endpoint.
3. Haz clic en **Test Handshake IOL MCP** para comprobar latencia y conectividad.
4. En la pestaña **Carteras & Patrimonio > Cartera IOL**, pulsa **⚡ Sincronizar Portafolio IOL** para importar automáticamente tus títulos y valuaciones al libro contable unificado.

---

## 4. Manejo de CEDEARs y Ratios

Ticker Tape detecta automáticamente si el activo es un CEDEAR (por ejemplo, `SPY`, `AAPL`, `NVDA`, `TSLA`):
- Registra el ratio de conversión (ej. `SPY 20:1`, `AAPL 10:1`).
- Calcula el tipo de cambio implícito (Contado con Liquidación - CCL):
  $$\text{CCL Implícito} = \frac{\text{Precio CEDEAR ARS} \times \text{Ratio}}{\text{Precio Subyacente USD}}$$
- Clasifica la exposición cambiaria en `USD_CCL`, protegiendo el análisis de riesgo frente a la depreciación del peso.
