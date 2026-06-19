# Spec: Trading Engine Core

> Phase 1 — Foundation
> Capability: `trading-engine`

---

## Requirements

### REQ-ENG-01: OHLCV Data Model
The system MUST define a canonical `OHLCVBar` struct with:
- `symbol: String` — ticker symbol (e.g. "SPY")
- `date: NaiveDate` — trading date
- `open, high, low, close: f64` — price fields
- `volume: f64` — trading volume
- `implied fields`: `range = high - low`, `body = |close - open|`, `direction = close >= open`

### REQ-ENG-02: Bar Collection
The system MUST provide a `BarCollection` wrapper over `Vec<OHLCVBar>` with:
- `new(bars: Vec<OHLCVBar>) -> Self` with validation (sorted by date, no duplicates)
- `len() -> usize`
- `range() -> (NaiveDate, NaiveDate)`
- `returns() -> Vec<f64>` — daily returns (log or simple, configurable)
- `apply_sma(period: usize) -> Vec<Option<f64>>`

### REQ-ENG-03: Strategy Trait
The system MUST define a `Strategy` trait:
```rust
#[async_trait]
pub trait Strategy: Send + Sync {
    fn name(&self) -> &str;
    fn parameters(&self) -> Vec<ParamDef>;
    async fn evaluate(&self, symbol: &str, bars: &BarCollection) -> Vec<Signal>;
}
```

### REQ-ENG-04: Built-in Strategies
The system MUST ship with at least:
- `MACrossover { fast: usize, slow: usize }` — generates Buy when fast MA crosses above slow, Sell on cross below
- `BollingerBands { period: usize, stddev: f64 }` — generates Buy when close touches lower band, Sell at upper band
- `RSI { period: usize, overbought: f64, oversold: f64 }` — generates Sell when RSI > overbought, Buy when RSI < oversold

### REQ-ENG-05: Signal Model
Signal MUST contain:
- `symbol: String`
- `direction: Direction { Buy, Sell, Neutral }`
- `strength: f64` — confidence 0.0–1.0
- `timestamp: DateTime<Utc>`
- `source: String` — strategy name
- `metadata: Value` — extra info (e.g. crossover prices, indicator values)

### REQ-ENG-06: Signal Aggregation
A `SignalAggregator` MUST implement:
- `add_strategy(strategy: Box<dyn Strategy>)` — register a strategy
- `analyze(symbol: &str, bars: &BarCollection) -> Vec<Signal>` — run all strategies and aggregate
- Aggregation logic: consensus voting (Buy if >50% strategies say Buy, Sell if >50% say Sell, else Neutral)
- Weighted scoring: each strategy has a configurable weight

### REQ-ENG-07: Backtesting Engine
The `Backtester` MUST support:
- `new(initial_capital: f64) -> Self`
- `run(strategy: &dyn Strategy, bars: &BarCollection) -> BacktestResult`
- `BacktestResult` containing: `total_return`, `annualized_return`, `sharpe`, `max_drawdown`, `win_rate`, `num_trades`, `equity_curve: Vec<f64>`
- Position sizing: fixed fraction of capital per trade (e.g. 2%)

### REQ-ENG-08: Risk Metrics
Pure functions for:
- `calculate_var(returns: &[f64], confidence: f64) -> f64` — historical VaR
- `calculate_sharpe(returns: &[f64], risk_free: f64) -> f64` — annualized Sharpe
- `calculate_max_drawdown(equity: &[f64]) -> f64` — peak-to-trough drawdown
- `calculate_volatility(returns: &[f64]) -> f64` — annualized volatility

---

## Scenarios

### Happy Path: Strategy Backtest
1. Create `BarCollection` from 2 years of SPY daily data
2. Create `MACrossover { fast: 50, slow: 200 }`
3. Create `Backtester::new(100_000.0)`
4. Run backtest
5. Expect: `BacktestResult` with `num_trades > 0`, `equity_curve.len() > 0`

### Edge Case: Empty Data
1. Create empty `BarCollection`
2. Run any strategy → returns empty `Vec<Signal>`
3. Run backtest → returns zeroed metrics (no crash)

### Edge Case: Insufficient Data
1. Create `BarCollection` with 10 bars
2. Run `MACrossover { fast: 50, slow: 200 }` → returns empty signals (not enough data)
3. No crash, graceful degradation

### Error Case: Invalid Parameters
1. `MACrossover { fast: 0, slow: 200 }` → strategy creation panics or returns error
2. `BarCollection::new()` with unsorted bars → sorts automatically or returns error

---

## Acceptance Criteria

- [ ] `OHLCVBar` and `BarCollection` compile and pass simple unit tests
- [ ] `MACrossover` produces correct crossover signals (verified on known data)
- [ ] `Backtester::run` produces correct `BacktestResult` (verified against Python backtest on same data)
- [ ] `calculate_sharpe` matches reference implementation within 1e-6
- [ ] Empty/insufficient data panics nowhere
- [ ] All public functions documented with doc comments
