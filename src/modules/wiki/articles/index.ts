import type { WikiArticle } from '../types';

export const WIKI_ARTICLES: WikiArticle[] = [
  {
    id: 'estudio-equity-curve',
    title: 'Estudio de la Equity Curve (Curva de Capital)',
    category: 'Administración de Cartera',
    icon: '📈',
    readTime: '6 min',
    summary: 'Metodología para evaluar la evolución del capital, análisis chartista sobre la equidad, línea de regresión/reversión, rachas y zonas de drawdown.',
    content: `
# Estudio de la Equity Curve (Curva de Capital)

El estudio de la **Equity Curve** (curva de activo o curva de capital) es uno de los análisis fundamentales en la gestión profesional de carteras y sistemas de trading. En lugar de limitarse a mirar el resultado final, este enfoque analiza la **trayectoria temporal** con la que se generan las ganancias y pérdidas.

---

## 1. Conformación de la Curva
Para construir la serie temporal de la Equity Curve se registran cronológicamente las operaciones:
1. **Fecha / Hora** de corte (diaria o por operación).
2. **Resultado financiero incurrido** (ganancias o pérdidas realizadas más valuación flotante de posiciones abiertas).
3. **Equidad acumulada**: Partiendo de un capital inicial (ej. $10.000), se suma o resta el flujo neto de cada período.

### Versiones de Análisis
Se recomienda desagregar la Equity Curve en 3 variantes:
- **Curva Total Consolidada**: La suma de todas las operaciones (visión integral).
- **Curva Sólo Compras (Longs)**: Evalúa la eficiencia del sistema en fases alcistas.
- **Curva Sólo Ventas (Shorts)**: Evalúa la capacidad de cobertura o generación de alfa a la baja.

> **Objetivo Práctico:** Determinar si el operador o la cartera posee asimetría direccional y definir con precisión el tamaño de la **Unidad de Trading (UT)**.

---

## 2. Análisis Chartista sobre la Equity Curve
Al igual que con un activo financiero, la curva de capital es susceptible de ser analizada con herramientas chartistas:

### A. Pendiente (Slope de Crecimiento)
A través de una **Regresión Lineal ($y = mx + b$)**:
- La pendiente $m$ representa la tasa de crecimiento monetario por unidad de tiempo ($/día).
- El coeficiente $R^2$ mide la suavidad y consistencia del crecimiento. Un $R^2 > 0.85$ indica un retorno estable con baja dispersión.

### B. Análisis de Reversión (Línea Central)
- **High Performance (Sobre-rendimiento):** Cuando la equidad se sitúa por encima de la línea de regresión/reversión. La cartera está en racha favorable.
- **Under Performance (Bajo rendimiento):** Cuando la curva cruza por debajo de la línea de regresión. Se detecta una pérdida de momentum en el sistema.

### C. Análisis de Tendencia y Rachas
- Permite contabilizar rachas ganadoras consecutivas (*winning streaks*) y perdedoras (*losing streaks*).
- Cruces de medias móviles (ej. SMA 20 sobre la curva) alertan sobre cambios estructurales de tendencia en los resultados.

---

## 3. Análisis Cuantitativo de Drawdown
El Drawdown no debe medirse únicamente como un porcentaje aislado, sino en tres dimensiones:
1. **Profundidad Máxima (Max Drawdown %):** Caída porcentual máxima desde el último pico histórico (*High-Water Mark*).
2. **Duración en el tiempo (*Time Underwater*):** Cuántos días transcurren desde que la curva abandona el máximo hasta que lo recupera.
3. **Single-Day Drawdown:** La mayor pérdida experimentada en una sola jornada, clave para la gestión del estrés de liquidez.

---

## 4. Reglas Operativas de Escalabilidad
- **Cuándo escalar (Add-ons):** Cuando la curva se encuentra en fase de *High Performance* con pendiente positiva y retrocede a su media móvil sin quebrar la línea de regresión.
- **Cuándo desescalar:** Cuando la equidad cruza por debajo de la línea de reversión, se debe reducir el tamaño de la Unidad de Trading (UT) al 50% o aumentar la porción de liquidez hasta que el sistema vuelva a confirmar tracción.
`,
  },
  {
    id: 'vwap-administracion-cartera',
    title: 'El VWAP en la Administración de Carteras',
    category: 'Modelos Cuantitativos',
    icon: '⚓',
    readTime: '5 min',
    summary: 'Ponderación de UTs ante múltiples entradas, indicador de eficiencia de ejecución institucional y soporte/resistencia dinámico.',
    content: `
# El VWAP en la Administración de Carteras

En la gestión profesional de carteras, rara vez se ingresa a una posición en un único bloque de órdenes. La acumulación por tramos exige herramientas matemáticas precisas para ponderar el costo base y evaluar la calidad de las ejecuciones.

---

## 1. Ponderación de Posiciones (UTs)
Ante múltiples entradas a diferentes precios y cantidades, el precio promedio simple es un error conceptual. Se debe aplicar el **VWAP Posicional** (Volume Weighted Average Price):

$$VWAP_{pos} = \\frac{\\sum (\\text{Cantidad}_i \\times \\text{Precio}_i)}{\\sum \\text{Cantidad}_i}$$

### Ejemplo Práctico de los Apuntes:
| Entrada | Cantidad (UTs) | Precio ($) | Monto Total ($) |
| :--- | :--- | :--- | :--- |
| Tramo 1 | 350 | 2.46 | 860.10 |
| Tramo 2 | 150 | 2.70 | 405.00 |
| Tramo 3 | 210 | 3.099 | 650.79 |
| Tramo 4 | 180 | 3.91 | 703.80 |
| Tramo 5 | 150 | 5.00 | 750.00 |
| **Total** | **1040 UTs** | **$3.24 (Promedio)** | **$3369.70** |

---

## 2. VWAP como Indicador de Eficiencia
El VWAP es la referencia institucional por excelencia:
- **Eficiencia Institucional:** Se calcula comparando el precio medio de compra acumulado contra la línea del VWAP del mercado general durante la ventana de armado de la cartera.
- Si nuestras compras se concretaron **por debajo del VWAP del mercado**, la ejecución fue superior (*Institutional Quality*).
- Si compramos persistentemente por encima del VWAP, denota persecución de precios y sobrecostos operativos.

---

## 3. VWAP como Indicador de Tendencia y Señales
1. **Dirección y Pendiente:**
   - Pendiente positiva en el VWAP $\\rightarrow$ Tendencia estructural alcista.
   - Pendiente negativa $\\rightarrow$ Tendencia estructural bajista.
   - Cambios en la curvatura de la pendiente alertan sobre aceleración o agotamiento del movimiento.
2. **Soporte y Resistencia Dinámico:**
   - En una tendencia sana, los retrocesos encuentran soporte en el VWAP de la posición y del mercado.
   - Cruces por debajo del VWAP actúan como disparadores de salida o cobertura preventiva.
`,
  },
  {
    id: 'modelo-exo-desescalamiento',
    title: 'Modelo EXO: Des/Escalamiento por Retorno y Riesgo Ajustado',
    category: 'Modelos Cuantitativos',
    icon: '⚖️',
    readTime: '7 min',
    summary: 'Dinámica de degradación del ratio B/R a medida que el trade avanza hacia el target y reglas sistemáticas de desescalamiento.',
    hasInteractiveWidget: 'EXO_CALCULATOR',
    content: `
# Modelo EXO: Des/Escalamiento por Retorno y Riesgo Ajustado

Basado en el modelo cuantitativo de la planilla **Ajustar retorno por riesgo - EXO**, esta metodología resuelve uno de los dilemas psicológicos y matemáticos más comunes del operador: **¿por qué arriesgar ganancias acumuladas para buscar un residual mínimo?**

---

## 1. La Asimetría Oculta del Trade Exitoso
Al abrir una operación se define un ratio Beneficio/Riesgo inicial:
$$\\text{B/R Inicial} = \\frac{\\text{Target} - \\text{Entrada}}{\\text{Entrada} - \\text{Stop Loss}}$$

Por ejemplo: Entrada a **$100**, Stop a **$90** (Riesgo = $10), Target a **$150** (Beneficio = $50). El ratio inicial es **5.0 a 1**.

Sin embargo, a medida que el precio sube:
1. **El capital arriesgado aumenta:** Si el precio alcanza $140, si retrocediera al Stop original de $90, el operador perdería **$50 de ganancia flotante + $10 iniciales = $60 de capital arriesgado**.
2. **La ganancia esperada disminuye:** De $140 a $150 sólo restan **$10** por ganar.
3. **El B/R Ajustado se derrumba:**
$$B/R_{ajustado} = \\frac{\\text{Target} - P_t}{P_t - \\text{Stop Loss}} = \\frac{150 - 140}{140 - 90} = \\frac{10}{50} = 0.20$$

> ⚠️ **Conclusión Crítica:** En las etapas finales de un trade ganador, el operador está arriesgando $50 de ganancias acumuladas para ganar tan sólo $10. El ratio se ha invertido completamente en su contra.

---

## 2. Fórmulas Matemáticas del Modelo EXO
En cada punto temporal $t$ con precio $P_t$:
- **Retorno no realizado flotante:** $R_t = P_t - P_0$
- **Máximo capital arriesgado actual:** $Riesgo_t = (P_0 - SL) + (P_t - P_0) = P_t - SL$
- **Ganancia esperada remanente:** $Ganancia_t = TP - P_t$
- **Ratio B/R Ajustado:**
$$B/R_{ajustado} = \\frac{Ganancia_t}{Riesgo_t} = \\frac{TP - P_t}{P_t - SL}$$

---

## 3. Semáforo Operativo y Decisiones Sistemáticas

| Ratio B/R Ajustado | Fase del Trade | Acción Recomendada |
| :--- | :--- | :--- |
| **$B/R \\ge 2.0$** | **Fase Temprana / Crecimiento** | **Permitido Escalar (Add-on):** Es seguro sumar UTs en pullbacks a soportes o VWAP. |
| **$1.0 \\le B/R < 2.0$** | **Fase de Maduración** | **Mantener (Hold):** Relación beneficio/riesgo equilibrada. |
| **$0.5 \\le B/R < 1.0$** | **Zona de Alerta** | **Ceñir Stop Loss:** Subir stop a Breakeven o trailing para blindar el capital. |
| **$B/R < 0.5$** | **Asimetría Crítica** | **Desescalar (Toma Parcial 30% a 50%):** Liquidar parte de la posición y asegurar beneficios. |
`,
  },
  {
    id: 'medidas-riesgo-rendimiento',
    title: 'Medidas de Riesgo y Rendimiento en Carteras',
    category: 'Gestión del Riesgo',
    icon: '📊',
    readTime: '6 min',
    summary: 'Volatilidad histórica ponderada y de la equity curve, Beta de mercado, ratios Sharpe, Sortino, Treynor, Jensen y Retorno Real.',
    content: `
# Medidas de Riesgo y Rendimiento en Carteras

El riesgo de una cartera depende del riesgo de mercado de sus componentes. La única forma de anular el riesgo es no participar.

---

## 1. Riesgo Sistemático y No Sistemático
- **Riesgo Diversificable (No Sistemático):** Es inherente a cada empresa o sector específico. Se elimina combinando activos descorrelacionados.
- **Riesgo No Diversificable (Sistemático):** Es el riesgo general del mercado en su conjunto (factores macroeconómicos, tasas, liquidez).

### La Prima de Riesgo (PR)
Mide el excedente de retorno esperado respecto a la tasa libre de riesgo (bonos del tesoro a 10 años, $RF$):
$$PR = RM - RF$$
> **Regla de Viabilidad:** Para justificar someterse a la renta variable, el retorno esperado de la cartera ($RM$) debe ser **como mínimo el doble de $RF$**.

---

## 2. Coeficiente Beta ($\\beta$)
Mide la sensibilidad de la cartera frente a los movimientos del índice rector (ej. S&P 500 o Merval):
- $\\beta < 1$: **Cartera Defensiva** (menor volatilidad que el mercado).
- $\\beta = 1$: **Cartera Neutra** (réplica directa del mercado).
- $\\beta > 1$: **Cartera Agresiva** (amplifica movimientos; típica en carteras con derivados o tecnológicas).

---

## 3. Ratios de Rendimiento Comparativo
1. **Sharpe Ratio:** Excedente de retorno sobre el riesgo total (desviación estándar).
   $$\\text{Sharpe} = \\frac{R_p - R_f}{\\sigma_p}$$
2. **Sortino Ratio:** Excedente de retorno castigando **únicamente** la volatilidad a la baja (*downside deviation*).
3. **Treynor Ratio:** Excedente de retorno por unidad de riesgo sistemático (Beta).
   $$\\text{Treynor} = \\frac{R_p - R_f}{\\beta_p}$$
4. **Jensen's Alpha ($\\alpha$):** Mide la capacidad pura del gestor de generar retorno por encima del modelo CAPM.
5. **Ratio Paolucci:** Métrica adaptada para cuantificar la eficiencia de posturas compradas y vendidas.

---

## 4. Retorno Real Neto Multidimensional
El rendimiento nominal puede ser un espejismo. El análisis de retorno real descuenta cuatro factores clave:
$$\\text{Retorno Real} = \\text{Retorno Cartera} - \\text{Tasa Libre Riesgo} - \\text{Benchmark} - \\text{Variación Tipo Cambio} - \\text{Inflación}$$

Todo valor por encima de este umbral neto constituye **ganancia real genuina**.
`,
  },
  {
    id: 'topologia-mercado-combinacion',
    title: 'Topología de Mercado y Combinación de Activos',
    category: 'Estructura de Mercado',
    icon: '🌐',
    readTime: '6 min',
    summary: 'Correlación cruzada, distancias euclidianas, Minimum Spanning Tree (MST) y técnica Metro para diversificación estructural.',
    content: `
# Topología de Mercado y Combinación de Activos

Más allá de la correlación tradicional, la **Topología de Mercado** proporciona una comprensión geométrica y relacional de cómo interactúan los activos de una cartera.

---

## 1. Correlación vs Correlación Cruzada
- En estadística matemática, lo que comúnmente se llama "correlación" es la correlación cruzada: el análisis de los desfases y alineación entre series temporales.
- Una cartera no puede diversificarse adecuadamente eligiendo simplemente "diferentes empresas" si todas responden a los mismos factores de liquidez.

---

## 2. El Minimum Spanning Tree (MST)
El esqueleto del mercado se construye en 4 etapas:
1. **Cálculo de la matriz de correlación.**
2. **Conversión a distancias euclidianas:**
   $$d_{i,j} = \\sqrt{2 (1 - \\rho_{i,j})}$$
   A mayor correlación, menor distancia euclidiana entre dos activos.
3. **Algoritmo de Kruskal:** Conecta todos los nodos minimizando la distancia total sin formar ciclos cerrados.
4. **Representación "Metro":** Muestra los clusters y líneas maestras del mercado.

---

## 3. Conformación de Cartera Balanceada
- Para una **cartera neutral/descorrelacionada**, se seleccionan activos ubicados en extremos opuestos del árbol o en ramas periféricas del *Maximum Spanning Forest (MSF)*.
- Para una **cartera tendencial**, se seleccionan los activos líderes que agrupan los nodos centrales con mayor conectividad.
`,
  },
];
