# Gaby's Trading Knowledge Base

> Síntesis de apuntes personales sobre trading, análisis de cartera, intermarket analysis,
> money management, sistemas de trading y herramientas. Fuente: `docs/` (2015–2017 aprox).
>
> **Propósito**: Referencia persistente para el agente IA — no compactar, siempre consultable.
> **Inconsistencias**: Son apuntes viejos, puede haber contradicciones. Se prioriza el enfoque
> conceptual sobre el detalle exacto.

---

## Tabla de Contenidos

1. [Portfolio & Money Management](#1-portfolio--money-management)
2. [Intermarket Analysis](#2-intermarket-analysis)
3. [Sistemas de Trading](#3-sistemas-de-trading)
4. [Herramientas](#4-herramientas)
5. [Futuros](#5-futuros)
6. [Métricas y Fórmulas](#6-métricas-y-fórmulas)

---

## 1. Portfolio & Money Management

### 1.1 Filosofía Central

> "Lo que define a un buen operador no es su capacidad analítica, timing o tiempo de mercado;
> lo que lo define es el manejo del dinero, el riesgo y las posiciones."

- **Evitar pérdidas** es más importante que conseguir grandes ganancias (largo plazo).
- Cuanto más grande el portfolio, mayor el impacto monetario de una caída porcentual.
- Se necesita una **ganancia porcentual mayor** para compensar una pérdida porcentual.
- Ejemplo: -50% en mes 1 → se necesita +100% en mes 2 para volver al capital inicial.

### 1.2 Tipos de Activos

| Activo | Características |
|--------|----------------|
| Renta Variable | Rentabilidad influenciada por estrategia + riesgo + money management |
| Renta Fija | Menos variación de capital, pero puede ser extremadamente rentable con buena estrategia |
| ETFs | Diversificación automática por sector. NO replican al índice exactamente al ser operados |
| Opciones | Cobertura de riesgo / Cobertura de riesgo de oportunidad / Potenciamiento de retornos |
| Futuros | Uso esporádico, con cuidado, fracción del capital |
| Sintéticos | Estrategia de conformación de cartera o al alcanzar objetivo de ganancias/pérdidas |

### 1.3 Cartera Base (Diversificación Tradicional)

```
Capital Total
├── 50% Renta Fija
└── 50% Renta Variable
    └── Fracción → Derivados y Trading de corto plazo
```

### 1.3.1 Cartera Agresiva

```
Capital Total
├── 50% → Adquirir cartera en partes iguales
└── 50% → Efectivo para comprar UTs adicionales si algún activo baja
```

### 1.4 Diversificación

Markowitz (1990, Nobel): Portfolios con desviaciones estándar altas pero correlaciones inversas
pueden dar tasa de retorno más alta con desviación estándar agregada más baja.

**4 metodologías de diversificación** (ninguna tiene eficiencia limitada):

| Metodología | Descripción |
|-------------|-------------|
| Entre parámetros para el mismo sistema | Mismo sistema de trading, distintos parámetros en distintos activos |
| Entre sistemas para el mismo activo | Corto, mediano y largo plazo para el mismo activo |
| Entre activos para el mismo sistema | Mismo sistema aplicado a diferentes activos/sectores |
| Combinación de los 3 anteriores | La mejor forma de diversificación disponible |

**Reglas de diversificación:**
- Incrementar cantidad de activos disminuye volatilidad y riesgo (tiene un límite).
- En mercados reducidos la diversificación tradicional no funciona.
- Incluir diversificación cambiaria para eliminar riesgo cambiario.
- La correlación debe medirse en **tractions**, no con índices (eso es Beta modificado).
- **Nunca inviertas en algo que se pueda vencer o morir** (alimentos, plaguicidas, químicos).

### 1.5 Rebalanceo de Cartera

**3 escenarios para rebalancear:**
1. **Agresivo**: "Me quedo con lo que responde mejor" — reasignar componente especulación.
   - Si no alcanza: (a) agregar efectivo externo, (b) asignar rendimiento de bonos.
2. **Leve**: Vender lo suficiente y asignar ese capital proporcionalmente.
3. **Opciones**: Lanzamiento cubierto fraccional (deep in/out the money).

**Frecuencia de rebalanceo:**
- Semestral o anual.
- Por cada amortización (si uso RF como benchmark).
- Cuando un componente del 50% supera el 65%.
- Cuando un componente del 25% supera en 10 puntos a otro.
- Cuando hay una pérdida.

### 1.6 Stop-Loss y Take-Profit

**Stop-loss:**
- ATR-based
- Percentage-based
- Volatility-based

**Take-profit:**
- Risk-reward ratio targets (1:2, 1:3)
- Trailing

**Circuit breakers:** Daily/weekly loss limits.

### 1.7 Position Sizing

- **Kelly Criterion**: Limitar fracción a 0.25 max, usar fractional Kelly.
- **Fixed Fraction**: 1-2% risk por posición.
- **Fixed Ratio**.
- **Liquidity risk**: Postura completa no puede ser >1% del volumen promedio del activo.

### 1.8 Equity Curve Analysis

```
Equity Curve
├── Pendiente → Tendencia (rachas)
├── Línea de reversión → Underperformance / High performance
├── Drawdown → Profundidad, duración, tiempo de recupero, single-day drawdown
└── Escalabilidad → Si cruza la línea de reversión por debajo, puedo desescalar
```

3 versiones del análisis: solo compras, solo ventas, o suma de ambas (para determinar si el sistema funciona mejor al alza o a la baja).

---

## 2. Intermarket Analysis

### 2.1 Premisas Fundamentales

1. Todos los mercados están interrelacionados — no se mueven en forma aislada.
2. El análisis intramercado provee datos de fondo importantes.
3. Usa datos externos en lugar de internos.
4. El AT es el vehículo preferido (el AC es más complejo).
5. El AT en mercados relacionados tiene que ser tomado en cuenta.

### 2.2 Los 4 Sectores

```
Monedas → Commodities → Bonos → Acciones
```

El círculo del intermarket:

```
Acciones ← → Bonos (relación positiva)
Bonos ← → Commodities (relación inversa) ← CLAVE
Commodities ← → Dólar (relación inversa)
Dólar ← → Tasas de interés
```

**Orden de análisis recomendado:**
1. Dólar
2. Tasas
3. Commodities
4. Bonos
5. Acciones

### 2.3 Relaciones Clave (con notación)

| Relación | Notación | Descripción |
|----------|----------|-------------|
| Acción dentro de commodities | A ∈ C | — |
| Entre grupos de commodities | AC₁ ↔ AC₂ | — |
| CRB y los grupos | CRB = f(A, C, M, B) | Índice CRB en función de los sectores |
| Commodities ↔ Bonos | C ∝ 1/B | **Inversa** — la clave del sistema |
| Bonos ↔ Acciones | B ∝ A | **Positiva** — se confirmutan entre sí |
| Dólar ↔ Commodities (oro) | D ∝ 1/C_oro | **Inversa** — el oro es el más sensible |
| Futuros ↔ Acciones relacionadas | F ↔ A | — |
| Mercados USA ↔ Internacionales | (B_USA, A_USA) ↔ (B_INT, A_INT) | — |

### 2.4 Ciclo Económico

**4 fases:** Arranque → Crecimiento → Madurez → Recesión
(aka: Recuperación → Expansión → Auge → Recesión)

**Problema**: Desde la Revolución Francesa/Industrial hay un superciclo alcista de ~250 años.
Los mercados se mantienen más tiempo en stage 3 (madurez/auge). El ciclo de mercado se adelanta al ciclo económico.

**Rotación sectorial por ciclo:**
- Las fases del ciclo predicen qué activo va a tener más interés/volumen/volatilidad.
- El análisis intermarket permite rotar cartera según la fase del ciclo.

### 2.5 Bonos y Acciones

| Factor | Efecto en Acciones |
|--------|-------------------|
| Suba de tasa de interés | **Bajista** |
| Baja de tasa de interés | **Alcista** |
| Bonos en alza | Generalmente alcista |
| Bonos en baja | Generalmente bajista |

- Los bonos actúan como **indicador adelantado** de las acciones.
- Cuando tienen tendencias opuestas → **momento de preocuparse**.
- **Positive curve shield**: situación normal (tasas CP < tasas LP).
- **Inverted curve yield**: bajista para acciones.
- En periodos deflacionarios, la relación bono-acción puede romperse.

### 2.6 Commodities y Dólar

| Escenario | Efecto |
|-----------|--------|
| Dólar en caída + commodities subiendo | **Bajista** para bonos y acciones (inflacionario) |
| Dólar en suba + commodities cayendo | **Alcista** para bonos y acciones |
| Dólar cae → inflacionario | Tarda tiempo en influenciar todo el sistema |

- El **oro** adelanta cambios en el índice CRB.
- El oro es el **más sensible al dólar** — un cambio en el dólar produce un cambio opuesto en el oro casi inmediato.
- El impacto inflacionario de commodities está **mayormente determinado por la tendencia del dólar**.

### 2.7 Fuerza Relativa en Intermarket

**Método:**
1. Dividir la acción por un índice de mercado.
2. Si la línea de FR sube → superación contra el índice.
3. Si la línea de FR declina → debilidad respecto del índice.
4. Comportamiento alcista/bajista debe estar confirmado por la FR.

**Aplicación:** rankings mediante creación de índices, detección de divergencias.

### 2.8 Activos Comunes para Análisis

- SP500 → índice
- CRB → commodities index
- US → US dollar
- 10Y → tasa

---

## 3. Sistemas de Trading

### 3.1 Filosofía

> "Es un error común buscar una 'super operación'. El mercado es demasiado complejo.
> Es preferible buscar muchas operaciones beneficiosas pero pequeñas — guerra de guerrillas."

**Componentes de un sistema:**

```
Gatillo → Confirmación → Validación → Money Management → Manejo del Riesgo
(mecánico)                                       (discrecional)
```

### 3.2 Componentes Detallados

| Componente | Descripción |
|------------|-------------|
| **Gatillo** | La señal en sí. 3 modos: solo compra, solo venta, ambas (incluyendo always-in) |
| **Filtro** | Anula o confirma el gatillo. Puede ser convergente (media mayor), divergente (indicador opuesto), parámetro, barrera (soporte/resistencia) |
| **Validación** | Determina si el sistema es aplicable al activo. Herramientas: **Fuerza Relativa** y **Volatilidad Histórica** |
| **Factor Acelerador** | Señal/sistema/condición que permite incrementar expectativas de retorno. Se activa **una vez la operación está activa**, nunca antes |
| **Money Management** | Tamaño de posición, riesgo a correr, estrategia de manejo de posición activa |
| **Manejo del Riesgo** | Ex-ante (planificación) + Ex-post (manejo de posición activa) |

### 3.3 Ejemplo de Sistema (Medias)

```
Gatillo:    Cruce de EMAs 4 y 14
             Compra: EMA 4 cruza arriba de EMA 14
             Venta:  EMA 4 cruza abajo de EMA 14
Filtro:     EMA 18
             Normal: operar solo al alza cuando filtro alcista (pendiente +)
             Agresivo: cruce del filtro como always-in
Validación: Fuerza Relativa vs otros activos + Volatilidad Histórica
```

**Recomendación de valores:**
- Intradiario (5'): EMA 5 y 15 (subdivisiones exactas 5'/15'), filtro EMA 30
- Diario: EMA 5 y 10 (5=semana, 10=2 semanas), filtro EMA 20 (4 días = 1 mes)

### 3.4 Evaluación de Sistemas

| Criterio | Fórmula / Descripción |
|----------|----------------------|
| Ganancia Neta | Utilidad generada - costos de transacción (comisiones) |
| Ganancia Neta Promedio | Valor esperado de una operación. Si montos diferentes → promedio ponderado |
| Coeficiente de Variación | (DesvEst GN) / GN_promedio × 100. Mientras más cercano a 0, más representativo el promedio |
| Radio B/R | Promedio_OpPositivas / Promedio_OpNegativas. Mínimo 1.5, ideal 2.0 |
| Probabilidad de Ganancia | OpBeneficiosas / OpTotales. Mínimo 60%, ideal 75-85% |
| Drawdowns | Declinamiento de un máximo a un mínimo hasta nuevo swing |

### 3.5 Optimización

> "Optimization is the mother of all fuckups."

**Tipos:** Lineal (todas las combinaciones, lento) y Genética (evolutiva, más rápido pero reglas ocultas del programador).

**Límites:**
- Precios pasados no garantizan comportamiento futuro.
- Ejemplo: Estrategia de las Tortugas (1970s) hoy es obsoleta por cambios en regímenes de volatilidad.
- La sobreoptimización convierte todo en un mundo de ilusión.

### 3.6 Portabilidad

Un buen sistema debe operar diferentes: (a) tipos de activos, (b) activos dentro de una clase,
(c) compresiones temporales. A mayor portabilidad → más robusto.

### 3.7 Obsolescencia

Causas: (1) Cambio en régimen de volatilidad histórica, (2) Sobreoptimización en diseño.
Solución: planilla con registro histórico de volatilidad para responder rápido a cambios.

---

## 4. Herramientas

### 4.1 VWAP (Volume Weighted Average Price)

**Doble función:**

| Función | Descripción |
|---------|-------------|
| Indicador de eficiencia | Qué tan lejos están mis operaciones de la línea VWAP (referencia del mercado) |
| Indicador de tendencia | Pendiente negativa → tendencia bajista. Pendiente positiva → tendencia alcista. Cambios de pendiente → aceleración |

**Como ponderador de posiciones:** Precio promedio correcto ante múltiples entradas.

**Como sistema de trading:** Cruces del VWAP como señales de compra/venta. La línea funciona como soporte o resistencia.

### 4.2 Market Topology (MST)

Ver step 2 — Minimum Spanning Tree con algoritmo de Kruskal.

- **Modalidad activa**: Armar cartera. Neutral → activos más distantes. Tendencial → nodo que se ajuste al análisis de tendencia.
- **Modalidad pasiva**: Re-balancear carteras existentes. Convertir cartera de tendencia a neutral o viceversa.
- **MSF (Maximum Spanning Forest)**: Activos en los límites del árbol representan oportunidades de inversión.
- Los clusters **no siempre** son del mismo sector. Hay que medir distancias reales.

### 4.3 Punto y Figura (P&F)

**Reglas:**
- Solo considera la acción de los precios (no volumen).
- No incluye tiempo, solo variaciones de precios.
- X = demanda, O = oferta.
- Reversión de 3 puntos (más común).

**Líneas de tendencia:**
- Línea de soporte alcista (45° desde menor O post-señal de compra)
- Línea de resistencia alcista (desde última compra a primera pared de O)
- Línea de resistencia bajista (135° desde mayor X post-señal de venta)
- Línea de soporte bajista (desde resistencia bajista a primera X)

**Objetivos de precio:**
- **Cuenta Horizontal**: Columnas de base × 3 × valor_caja + mínimo de formación.
- **Cuenta Vertical**: Cajas de columna de quiebre × 3 (alcista) o × 2 (bajista) × valor_caja + primera X.
- La cuenta horizontal siempre es menor que la vertical.

**Patrones:** Doble techo, doble piso, triple techo, triple piso, catapulta alcista/bajista, triángulos.

### 4.4 Z-Score para Sistemas

Aplicado a rankear sistemas de trading:
1. Calcular R/B = RoR / |MaxDrawdown| para cada sistema.
2. Calcular promedio y desviación estándar de RoR y MaxDrawdown.
3. ZScore_RoR = (RoR_i - promedio_RoR) / desvEst_RoR.
4. ZScore_DD = (DD_i - promedio_DD) / desvEst_DD.
5. Eliminar sistemas con R/B < 1.5.

---

## 5. Futuros

### 5.1 Conceptos

- Creados para **cobertura**, no especulación.
- **Roll over**: Profesional (bienios, Bloomberg/Reuters/eSignal) vs Transaccional (cuando la liquidez se pierde en vencimientos cortos).
- **Front month**: Usar hasta ~14 días antes del vencimiento.
- **Margen**: Inicial (abrir posición) > Mantenimiento (posición abierta). El margen de mantenimiento **sube** si la operación se mueve adversamente. Intradiario es fijo.

### 5.2 Market Delta / Order Flow

- **Delta**: Diferencia neta entre volumen bid y ask.
- **Pasividad** (órdenes límite) puede cortar un movimiento direccional.
- **Agresividad** (órdenes a mercado en secuencia) puede empujar los precios.
- Evidencia de oferta agresiva: vendedores operan al bid → precios menores.
- Evidencia de demanda agresiva: compradores suben oferta → precios superiores.
- El delta es **muy importante** en futuros. Forex **no tiene** esta información (hay que ver los futuros).

### 5.3 Reglas Operativas

- Operar en momentos de **mayor liquidez**: apertura USA (punto alpha), apertura España (punto beta).
- **No operar** fuera del rango horario predefinido.
- **Preset**: PT y Stop de 2 puntos (8 ticks). Luego se ajusta.
- **No operar** cerca de noticias importantes.
- **Opening Range / Balance Inicial**: calcular contra balances iniciales previos. Si es chico → probable ruptura. Si es grande → probable congestión.

---

## 6. Métricas y Fórmulas

### 6.1 Riesgo

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| Prima de Riesgo | PR = RM - RF | RM = rendimiento promedio del activo/cartera. RF = tasa libre de riesgo (10y US) |
| Regla práctica | RM ≥ 2 × RF | Si no, no vale la pena asumir el riesgo |
| Desviación Estándar | σ = √(Σ(Ri - R̄)² / n) | Variabilidad de rendimientos en torno al valor esperado. Mide **riesgo total** |
| Beta | β = Cov(Ri, Rm) / σ²m | Riesgo del activo respecto al mercado. Mide solo **riesgo sistemático** |
| Beta < 1 | — | Cartera defensiva |
| Beta = 1 | — | Rendimientos = mercado. Ideal en mínimos absolutos (ej: SPY en 2008) |
| Beta > 1 | — | Cartera agresiva. También: operar opciones (la palanca da β > 1) |
| Sharpe | (E_R - RF) / σ_p | Retorno esperado ajustado por riesgo total |
| Sortino | (E_R - RF) / σ_ downside | Sharpe pero solo con desviación bajista |
| Jensen's Alpha | α = PR - (RF + β·(RM - RF)) | Exceso de retorno sobre el esperado por el riesgo |
| Treynor | (E_R - RF) / β_p | Retorno esperado ajustado por riesgo sistemático |
| Safety First | (E_R - R_objetivo) / σ_p | Probabilidad de no alcanzar el retorno objetivo |
| Paolucci (long) | (E_R - R_obj) / σ_bajista | — |
| Paolucci (short) | (E_R - R_obj) / σ_alcista | — |
| **Excess Return** | RE = E_R - R_benchmark | **La medida de rendimiento más importante** |

### 6.2 Retorno Real (Análisis Completo)

```
Retorno Real = E_R - RF - R_benchmark - ΔTC - Inflación
```

Donde:
- E_R - RF = prima sobre tasa libre de riesgo
- E_R - R_benchmark = excess return vs benchmark
- E_R - ΔTC = retorno ajustado por tipo de cambio
- E_R - Inflación = retorno real ajustado por inflación

De ahí en adelante es **ganancia real**.

### 6.3 Volatilidad Histórica de Cartera (3 formas)

1. Calcular volatilidades individuales y ponderarlas.
2. Calcular VH de la cartera directamente (rendimientos de cartera completa, no de componentes).
3. Calcular equity curve y la volatilidad del equity curve.

### 6.4 Riesgo

| Tipo | Descripción |
|------|-------------|
| Diversificable | Se elimina con diversificación |
| No diversificable (sistemático) | No se puede eliminar. La única forma es no operar |
| De liquidez | Postura ≤ 1% del volumen promedio del activo |

### 6.5 Fórmulas P&F

```
Objetivo Alcista (Vertical) = (Cajas_en_columna_quiebre × 3 × valor_caja) + primera_X
Objetivo Bajista (Vertical) = (Cajas_en_columna_quiebre × 2 × valor_caja) - primera_X  [desde máximo]
Objetivo (Horizontal) = (Columnas_en_base × 3 × valor_caja) + mínimo_formación
```

---

> **Nota**: Este knowledge base se armó a partir de apuntes personales (2015-2017).
> Puede haber inconsistencias. El valor está en el enfoque conceptual, no en el detalle exacto.
> Se usa como referencia para el desarrollo del módulo Portfolio+Money Management (step 6/6)
> y futuros módulos de Ticker Tape.
