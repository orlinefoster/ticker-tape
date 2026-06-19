# Spec: Intermarket Module

> Phase 2a — Analysis Core
> Capability: `intermarket`
> Pipeline position: 1/6

---

## Requirements

### REQ-INT-01: Cycle Phase Detection
El módulo DEBE clasificar la fase del ciclo económico en la que estamos usando datos intermarket:
- `EarlyExpansion` — stocks suben, bonos caen, commodities estables/suben
- `LateExpansion` — stocks suben, commodities suben fuerte, bonos caen
- `Peak` — stocks laterales/volátiles, commodities pico, bonos empiezan a subir
- `Contraction` — stocks caen, bonos suben, commodities caen
- `Trough` — todo buscando piso, bonos fuertes

### REQ-INT-02: Asset Class Data
El módulo DEBE trabajar con al menos:
- **Equities**: SPY (o equivalente para mercado general)
- **Bonds**: TLT (long-term) + AGG (aggregate)
- **Commodities**: DBC (diversified) o GSG
- **Currency**: DXY (dollar index)
- **Sectors**: XLF (financiero), XLE (energía), XLV (salud), XLK (tecnología), XLI (industrial), XLP (consumer staples), XLY (consumer discretionary)

### REQ-INT-03: Key Ratios
El módulo DEBE calcular y mantener estos ratios:
- `StockBondRatio = SPY / TLT` — apetito por riesgo
- `CyclicalDefensiveRatio = (XLF + XLI + XLY) / (XLV + XLP)` — fase económica
- `CommodityBondRatio = DBC / TLT` — expectativas de inflación
- `DollarTrend = SMA(DXY, 50) / SMA(DXY, 200)` — tendencia del dólar

### REQ-INT-04: Evidence Aggregation
Cada indicador produce una señal (`Bullish | Bearish | Neutral`) con un peso configurable.

La fase final se determina por:
- Suma ponderada de señales
- Matriz de transición: no se puede saltar de Contraction a Peak sin pasar por Trough
- Confianza: proporción de indicadores que coinciden con la fase detectada

### REQ-INT-05: Output Structure
```rust
pub struct IntermarketReport {
    pub date: NaiveDate,
    pub phase: MarketPhase,
    pub confidence: f64,
    pub indicators: Vec<IndicatorResult>,
    pub key_ratios: KeyRatios,
    pub narrative: String,  // texto generado con los hallazgos clave
}

pub struct IndicatorResult {
    pub name: String,
    pub value: f64,
    pub signal: SignalDirection,  // Bullish, Bearish, Neutral
    pub weight: f64,
    pub description: String,
}

pub struct KeyRatios {
    pub stock_bond: f64,
    pub stock_bond_trend: TrendDirection,
    pub cyclical_defensive: f64,
    pub cyclical_defensive_trend: TrendDirection,
    pub commodity_bond: f64,
    pub dollar_trend: TrendDirection,
}
```

### REQ-INT-06: Module Trait (OCP)
```rust
#[async_trait]
pub trait AnalysisModule: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_type(&self) -> Vec<DataRequirement>;
    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>>;
}
```

### REQ-INT-07: Trend Direction
```rust
pub enum TrendDirection { Rising, Falling, Sideways }
```
- Rising: SMA(20) > SMA(50) + 1% threshold
- Falling: SMA(20) < SMA(50) - 1% threshold
- Sideways: everything else

---

## Scenarios

### Happy Path: Full Cycle Detection
1. Request Intermarket analysis for today
2. Module fetches data for all asset classes (SPY, TLT, DBC, DXY, sectors)
3. Computes all key ratios
4. Evaluates each indicator against cycle matrix
5. Returns `IntermarketReport` with phase=LateExpansion, confidence=0.82, all indicators populated

### Edge Case: Missing Data
1. DXY data unavailable (e.g., API limit)
2. Module runs with available data
3. Returns phase with lower confidence
4. Missing indicator logged with Neutral signal

### Edge Case: Conflicting Signals
1. Stock/Bond says Expansion, Cyclical/Defensive says Contraction
2. Module weights by historical reliability
3. Returns phase with low confidence (< 0.5)
4. Narrative highlights the conflict

### Error Case: No Data
1. No market data available at all
2. Returns error with clear message: "Intermarket analysis requires at least SPY and TLT data"

---

## Acceptance Criteria

- [ ] `IntermarketModule` implements `AnalysisModule` trait
- [ ] Cycle detection matches known historical phases (test on 2020, 2022, 2023 data)
- [ ] All key ratios computed correctly
- [ ] Confidence reflects signal agreement
- [ ] Missing data handled gracefully with lower confidence
- [ ] Narrative text generated in Spanish (configurable)
