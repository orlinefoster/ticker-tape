//! Trading strategies module
//!
//! Each strategy implements the Strategy trait and can be
//! composed, backtested, and executed by the engine.

use chrono::NaiveDate;

use crate::trading::models::{OHLCVBar, Signal, SignalDirection};

// ---------------------------------------------------------------------------
// ParamDef & ParamType
// ---------------------------------------------------------------------------

/// Describes a single configurable parameter of a strategy.
#[derive(Debug, Clone)]
pub struct ParamDef {
    pub name: String,
    pub type_: ParamType,
    pub default: serde_json::Value,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

/// Supported parameter types for strategy configuration.
#[derive(Debug, Clone)]
pub enum ParamType {
    Int,
    Float,
    Bool,
    Select(Vec<String>),
}

// ---------------------------------------------------------------------------
// Strategy trait
// ---------------------------------------------------------------------------

/// The core strategy trait — any strategy must implement this.
#[async_trait::async_trait]
pub trait Strategy: Send + Sync {
    /// Human-readable name of the strategy.
    fn name(&self) -> &str;

    /// Evaluate the strategy against a slice of OHLCV bars.
    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal>;

    /// Declare the configurable parameters for this strategy.
    ///
    /// Default implementation returns an empty list (strategies without
    /// user-facing parameters can skip this).
    fn parameters(&self) -> Vec<ParamDef> {
        Vec::new()
    }
}

// ---------------------------------------------------------------------------
// Moving Average Crossover
// ---------------------------------------------------------------------------

/// Moving Average Crossover strategy
pub struct MACrossover {
    pub fast_period: usize,
    pub slow_period: usize,
}

impl MACrossover {
    pub fn new(fast_period: usize, slow_period: usize) -> Self {
        Self {
            fast_period,
            slow_period,
        }
    }
}

#[async_trait::async_trait]
impl Strategy for MACrossover {
    fn name(&self) -> &str {
        "MA Crossover"
    }

    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal> {
        if self.fast_period == 0
            || self.slow_period == 0
            || self.fast_period >= self.slow_period
            || bars.len() < self.slow_period + 1
        {
            return Vec::new();
        }

        let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
        let mut signals = Vec::new();

        for i in self.slow_period..bars.len() {
            let prev_fast: f64 =
                closes[i - self.fast_period..i].iter().sum::<f64>() / self.fast_period as f64;
            let curr_fast: f64 =
                closes[i + 1 - self.fast_period..=i].iter().sum::<f64>() / self.fast_period as f64;

            let prev_slow: f64 =
                closes[i - self.slow_period..i].iter().sum::<f64>() / self.slow_period as f64;
            let curr_slow: f64 =
                closes[i + 1 - self.slow_period..=i].iter().sum::<f64>() / self.slow_period as f64;

            let bar = &bars[i];
            let ts = date_to_utc(bar.date);
            let denom = curr_slow.abs().max(1e-9);

            // Golden cross: fast SMA crosses above slow SMA
            if prev_fast <= prev_slow && curr_fast > curr_slow {
                let strength = (((curr_fast - curr_slow).abs() / denom) * 20.0).clamp(0.5, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Buy,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "fast_sma": curr_fast,
                        "slow_sma": curr_slow,
                        "fast_period": self.fast_period,
                        "slow_period": self.slow_period,
                    }),
                });
            }

            // Death cross: fast SMA crosses below slow SMA
            if prev_fast >= prev_slow && curr_fast < curr_slow {
                let strength = (((curr_slow - curr_fast).abs() / denom) * 20.0).clamp(0.5, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Sell,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "fast_sma": curr_fast,
                        "slow_sma": curr_slow,
                        "fast_period": self.fast_period,
                        "slow_period": self.slow_period,
                    }),
                });
            }
        }

        signals
    }
}

// ---------------------------------------------------------------------------
// Elliott Wave
// ---------------------------------------------------------------------------

/// Elliott Wave pattern detector
pub struct ElliottWave {
    pub min_wave_length: usize,
}

impl ElliottWave {
    pub fn new(min_wave_length: usize) -> Self {
        Self { min_wave_length }
    }
}

#[async_trait::async_trait]
impl Strategy for ElliottWave {
    fn name(&self) -> &str {
        "Elliott Wave"
    }

    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal> {
        if self.min_wave_length == 0 || bars.len() < 10 || bars.len() < self.min_wave_length * 2 {
            return Vec::new();
        }

        let lookback = self.min_wave_length.max(2);
        let min_wave_pct = 0.015; // 1.5% minimum swing amplitude
        let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
        let mut signals = Vec::new();
        let mut last_pivot_price = closes[0];

        for i in lookback..closes.len() {
            let window = &closes[i - lookback..i];
            let prev_min = window.iter().copied().fold(f64::INFINITY, f64::min);
            let prev_max = window.iter().copied().fold(f64::NEG_INFINITY, f64::max);
            let curr = closes[i];
            let prev = closes[i - 1];

            let bar = &bars[i];
            let ts = date_to_utc(bar.date);

            // Impulse turn up from swing low exceeding min_wave_pct
            if prev <= prev_min
                && curr > prev
                && last_pivot_price > 0.0
                && ((last_pivot_price - prev) / last_pivot_price) >= min_wave_pct
            {
                let swing_pct = ((last_pivot_price - prev) / last_pivot_price).abs();
                let strength = (swing_pct * 10.0).clamp(0.5, 1.0);
                last_pivot_price = curr;
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Buy,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "swing_low": prev,
                        "swing_pct": swing_pct * 100.0,
                    }),
                });
            } else if prev >= prev_max
                && curr < prev
                && last_pivot_price > 0.0
                && ((prev - last_pivot_price) / last_pivot_price) >= min_wave_pct
            {
                // Corrective turn down from swing high exceeding min_wave_pct
                let swing_pct = ((prev - last_pivot_price) / last_pivot_price).abs();
                let strength = (swing_pct * 10.0).clamp(0.5, 1.0);
                last_pivot_price = curr;
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Sell,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "swing_high": prev,
                        "swing_pct": swing_pct * 100.0,
                    }),
                });
            }
        }

        signals
    }
}

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------

/// Bollinger Bands mean-reversion strategy.
///
/// - Buy when close < lower band (oversold).
/// - Sell when close > upper band (overbought).
pub struct BollingerBands {
    pub period: usize,
    pub stddev: f64,
}

impl BollingerBands {
    /// Create a new BollingerBands strategy with sensible defaults.
    pub fn new(period: usize, stddev: f64) -> Self {
        Self { period, stddev }
    }
}

#[async_trait::async_trait]
impl Strategy for BollingerBands {
    fn name(&self) -> &str {
        "Bollinger Bands"
    }

    fn parameters(&self) -> Vec<ParamDef> {
        vec![
            ParamDef {
                name: "period".into(),
                type_: ParamType::Int,
                default: serde_json::json!(self.period),
                min: Some(2.0),
                max: Some(200.0),
            },
            ParamDef {
                name: "stddev".into(),
                type_: ParamType::Float,
                default: serde_json::json!(self.stddev),
                min: Some(0.5),
                max: Some(5.0),
            },
        ]
    }

    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal> {
        if self.period == 0 || bars.len() < self.period {
            return Vec::new();
        }

        let mut signals = Vec::new();
        let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();

        for i in (self.period - 1)..bars.len() {
            let window = &closes[i + 1 - self.period..=i];
            let sma: f64 = window.iter().sum::<f64>() / self.period as f64;

            // Population standard deviation
            let variance: f64 =
                window.iter().map(|&x| (x - sma).powi(2)).sum::<f64>() / self.period as f64;
            let stdev = variance.sqrt();

            let lower = sma - self.stddev * stdev;
            let upper = sma + self.stddev * stdev;

            let bar = &bars[i];
            let ts = date_to_utc(bar.date);

            // Buy when price touches or crosses below lower band.
            if bar.close <= lower {
                // Strength proportional to how far below the band (capped at 1.0).
                let denom = lower.abs().max(1e-9);
                let strength = ((lower - bar.close) / denom).clamp(0.1, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Buy,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "lower_band": lower,
                        "sma": sma,
                        "stdev": stdev,
                    }),
                });
            }

            // Sell when price touches or crosses above upper band.
            if bar.close >= upper {
                let denom = upper.abs().max(1e-9);
                let strength = ((bar.close - upper) / denom).clamp(0.1, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Sell,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "close": bar.close,
                        "upper_band": upper,
                        "sma": sma,
                        "stdev": stdev,
                    }),
                });
            }
        }

        signals
    }
}

// ---------------------------------------------------------------------------
// RSI (Wilder's method)
// ---------------------------------------------------------------------------

/// Relative Strength Index strategy using Wilder's smoothing.
///
/// - Buy when RSI crosses **below** `oversold` and then **above** it.
/// - Sell when RSI crosses **above** `overbought` and then **below** it.
pub struct RSI {
    pub period: usize,
    pub overbought: f64,
    pub oversold: f64,
}

impl RSI {
    pub fn new(period: usize, overbought: f64, oversold: f64) -> Self {
        Self {
            period,
            overbought,
            oversold,
        }
    }

    /// Compute the full RSI series using Wilder's method.
    ///
    /// Returns a vector of length `bars.len()` where the first `period`
    /// entries are `None` (insufficient data for a stable RSI).
    fn compute_series(&self, closes: &[f64]) -> Vec<Option<f64>> {
        if self.period == 0 || closes.len() < self.period + 1 {
            return vec![None; closes.len()];
        }

        let mut rsis = vec![None; self.period]; // first `period` values are None

        // Initial average gain / loss (simple average of first `period` deltas).
        let mut avg_gain = 0.0;
        let mut avg_loss = 0.0;

        for i in 1..=self.period {
            let delta = closes[i] - closes[i - 1];
            if delta > 0.0 {
                avg_gain += delta;
            } else {
                avg_loss -= delta; // delta is negative, so -delta is positive loss
            }
        }
        avg_gain /= self.period as f64;
        avg_loss /= self.period as f64;

        // Compute first valid RSI.
        let rs = if avg_loss == 0.0 {
            f64::INFINITY
        } else {
            avg_gain / avg_loss
        };
        rsis.push(Some(100.0 - 100.0 / (1.0 + rs)));

        // Iterate over the remaining bars using Wilder's smoothing.
        for i in (self.period + 1)..closes.len() {
            let delta = closes[i] - closes[i - 1];
            let gain = if delta > 0.0 { delta } else { 0.0 };
            let loss = if delta < 0.0 { -delta } else { 0.0 };

            avg_gain = (avg_gain * (self.period as f64 - 1.0) + gain) / self.period as f64;
            avg_loss = (avg_loss * (self.period as f64 - 1.0) + loss) / self.period as f64;

            let rs = if avg_loss == 0.0 {
                f64::INFINITY
            } else {
                avg_gain / avg_loss
            };
            rsis.push(Some(100.0 - 100.0 / (1.0 + rs)));
        }

        rsis
    }
}

#[async_trait::async_trait]
impl Strategy for RSI {
    fn name(&self) -> &str {
        "RSI"
    }

    fn parameters(&self) -> Vec<ParamDef> {
        vec![
            ParamDef {
                name: "period".into(),
                type_: ParamType::Int,
                default: serde_json::json!(self.period),
                min: Some(2.0),
                max: Some(100.0),
            },
            ParamDef {
                name: "overbought".into(),
                type_: ParamType::Float,
                default: serde_json::json!(self.overbought),
                min: Some(50.0),
                max: Some(100.0),
            },
            ParamDef {
                name: "oversold".into(),
                type_: ParamType::Float,
                default: serde_json::json!(self.oversold),
                min: Some(0.0),
                max: Some(50.0),
            },
        ]
    }

    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal> {
        if self.period == 0 || bars.len() < self.period + 1 {
            return Vec::new();
        }

        let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
        let rsis = self.compute_series(&closes);
        let mut signals = Vec::new();

        // We need at least two consecutive RSI values to detect a crossover.
        for i in 1..rsis.len() {
            let (Some(prev_rsi), Some(curr_rsi)) = (rsis[i - 1], rsis[i]) else {
                continue;
            };

            let bar = &bars[i];
            let ts = date_to_utc(bar.date);

            // Buy: crosses from below oversold to above oversold.
            if prev_rsi <= self.oversold && curr_rsi > self.oversold {
                let denom = (50.0 - self.oversold).abs().max(1.0);
                let strength = ((curr_rsi - self.oversold) / denom).clamp(0.1, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Buy,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "rsi": curr_rsi,
                        "prev_rsi": prev_rsi,
                        "oversold": self.oversold,
                    }),
                });
            }

            // Sell: crosses from above overbought to below overbought.
            if prev_rsi >= self.overbought && curr_rsi < self.overbought {
                let denom = (self.overbought - 50.0).abs().max(1.0);
                let strength = ((self.overbought - curr_rsi) / denom).clamp(0.1, 1.0);
                signals.push(Signal {
                    symbol: symbol.to_string(),
                    direction: SignalDirection::Sell,
                    strength,
                    timestamp: ts,
                    source: self.name().to_string(),
                    metadata: serde_json::json!({
                        "rsi": curr_rsi,
                        "prev_rsi": prev_rsi,
                        "overbought": self.overbought,
                    }),
                });
            }
        }

        signals
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Convert a `NaiveDate` to a UTC `DateTime` at midnight.
fn date_to_utc(d: NaiveDate) -> chrono::DateTime<chrono::Utc> {
    d.and_hms_opt(0, 0, 0)
        .expect("zero time is always valid")
        .and_utc()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    fn make_bar(date: NaiveDate, close: f64) -> OHLCVBar {
        OHLCVBar {
            symbol: "TEST".into(),
            date,
            open: close,
            high: close,
            low: close,
            close,
            volume: 1000.0,
        }
    }

    // -- Bollinger Bands tests -------------------------------------------------

    #[tokio::test]
    async fn test_bb_buy_signal() {
        // Prices start at 100, then dip sharply — should trigger a buy.
        let mut bars: Vec<OHLCVBar> = Vec::new();
        for i in 0..30 {
            let close = if i < 25 { 100.0 } else { 80.0 };
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap(),
                close,
            ));
        }
        let bb = BollingerBands::new(20, 2.0);
        let signals = bb.evaluate("TEST", &bars).await;
        // The last bars at 80 should be below the lower band → buy signal.
        let buys: Vec<&Signal> = signals.iter().filter(|s| s.direction == SignalDirection::Buy).collect();
        assert!(!buys.is_empty(), "Expected at least one buy signal");
    }

    #[tokio::test]
    async fn test_bb_sell_signal() {
        let mut bars: Vec<OHLCVBar> = Vec::new();
        for i in 0..30 {
            let close = if i < 25 { 100.0 } else { 130.0 };
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap(),
                close,
            ));
        }
        let bb = BollingerBands::new(20, 2.0);
        let signals = bb.evaluate("TEST", &bars).await;
        let sells: Vec<&Signal> = signals.iter().filter(|s| s.direction == SignalDirection::Sell).collect();
        assert!(!sells.is_empty(), "Expected at least one sell signal");
    }

    #[tokio::test]
    async fn test_bb_insufficient_data() {
        let bars = vec![make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0)];
        let bb = BollingerBands::new(20, 2.0);
        let signals = bb.evaluate("TEST", &bars).await;
        assert!(signals.is_empty());

        // Zero period guard
        let bb_zero = BollingerBands::new(0, 2.0);
        assert!(bb_zero.evaluate("TEST", &bars).await.is_empty());
    }

    #[tokio::test]
    async fn test_bb_parameters() {
        let bb = BollingerBands::new(20, 2.0);
        let params = bb.parameters();
        assert_eq!(params.len(), 2);
        assert!(params.iter().any(|p| p.name == "period"));
        assert!(params.iter().any(|p| p.name == "stddev"));
    }

    // -- RSI tests -------------------------------------------------------------

    #[tokio::test]
    async fn test_rsi_buy_signal() {
        // Create a downtrend followed by a reversal.
        let mut bars: Vec<OHLCVBar> = Vec::new();
        // Start at 100, drop to 80 over 15 days (oversold).
        for i in 0..20 {
            let close = 100.0 - (i as f64) * 1.5;
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap(),
                close.max(1.0),
            ));
        }
        // Then reverse up.
        for i in 0..10 {
            let close = 70.0 + (i as f64) * 3.0;
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (21 + i) as u32).unwrap(),
                close,
            ));
        }
        let rsi = RSI::new(14, 70.0, 30.0);
        let signals = rsi.evaluate("TEST", &bars).await;
        let buys: Vec<&Signal> = signals.iter().filter(|s| s.direction == SignalDirection::Buy).collect();
        // After the sharp drop, RSI should dip below 30, then the reversal
        // should push it back above 30 → buy signal.
        assert!(!buys.is_empty(), "Expected at least one buy signal from RSI crossover");
    }

    #[tokio::test]
    async fn test_rsi_sell_signal() {
        // Create an uptrend followed by a drop.
        let mut bars: Vec<OHLCVBar> = Vec::new();
        for i in 0..20 {
            let close = 100.0 + (i as f64) * 2.0;
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap(),
                close,
            ));
        }
        // Then reverse down.
        for i in 0..10 {
            let close = 140.0 - (i as f64) * 4.0;
            bars.push(make_bar(
                NaiveDate::from_ymd_opt(2024, 1, (21 + i) as u32).unwrap(),
                close,
            ));
        }
        let rsi = RSI::new(14, 70.0, 30.0);
        let signals = rsi.evaluate("TEST", &bars).await;
        let sells: Vec<&Signal> = signals.iter().filter(|s| s.direction == SignalDirection::Sell).collect();
        assert!(!sells.is_empty(), "Expected at least one sell signal from RSI crossover");
    }

    #[tokio::test]
    async fn test_rsi_insufficient_data() {
        let bars = vec![make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0)];
        let rsi = RSI::new(14, 70.0, 30.0);
        let signals = rsi.evaluate("TEST", &bars).await;
        assert!(signals.is_empty());

        // Zero period guard
        let rsi_zero = RSI::new(0, 50.0, 50.0);
        assert!(rsi_zero.evaluate("TEST", &bars).await.is_empty());
    }

    #[tokio::test]
    async fn test_rsi_parameters() {
        let rsi = RSI::new(14, 70.0, 30.0);
        let params = rsi.parameters();
        assert_eq!(params.len(), 3);
        assert!(params.iter().any(|p| p.name == "period"));
        assert!(params.iter().any(|p| p.name == "overbought"));
        assert!(params.iter().any(|p| p.name == "oversold"));
    }

    #[tokio::test]
    async fn test_rsi_no_noise() {
        // Flat price → no crossovers → no signals.
        let bars: Vec<OHLCVBar> = (0..30)
            .map(|i| {
                make_bar(
                    NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap(),
                    100.0,
                )
            })
            .collect();
        let rsi = RSI::new(14, 70.0, 30.0);
        let signals = rsi.evaluate("TEST", &bars).await;
        assert!(signals.is_empty(), "Flat price should not generate signals");
    }

    // -- MA Crossover & ElliottWave tests --------------------------------------

    #[tokio::test]
    async fn test_macrossover_default_parameters() {
        let ma = MACrossover {
            fast_period: 10,
            slow_period: 30,
        };
        // Default impl returns empty.
        assert!(ma.parameters().is_empty());
    }

    #[tokio::test]
    async fn test_macrossover_generates_buy_and_sell_signals() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let mut bars = Vec::new();
        // Flat/downtrend then strong uptrend (golden cross), then sharp drop (death cross)
        for i in 0..10 {
            bars.push(make_bar(start + chrono::Duration::days(i), 100.0 - i as f64));
        }
        for i in 10..20 {
            bars.push(make_bar(
                start + chrono::Duration::days(i),
                90.0 + (i - 10) as f64 * 4.0,
            ));
        }
        for i in 20..30 {
            bars.push(make_bar(
                start + chrono::Duration::days(i),
                130.0 - (i - 20) as f64 * 6.0,
            ));
        }

        let ma = MACrossover::new(3, 8);
        let signals = ma.evaluate("TEST", &bars).await;
        assert!(
            signals.iter().any(|s| s.direction == SignalDirection::Buy),
            "Expected golden cross Buy signal"
        );
        assert!(
            signals.iter().any(|s| s.direction == SignalDirection::Sell),
            "Expected death cross Sell signal"
        );

        // Zero period guard
        let ma_zero = MACrossover::new(0, 8);
        assert!(ma_zero.evaluate("TEST", &bars).await.is_empty());
    }

    #[tokio::test]
    async fn test_elliott_wave_strategy_signals() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let mut bars = Vec::new();
        // Drop from 100 to 90, then turn up, then rise to 110 and turn down
        let prices = [
            100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 93.0, 97.0, 102.0, 106.0, 110.0, 107.0, 103.0,
        ];
        for (i, &p) in prices.iter().enumerate() {
            bars.push(make_bar(start + chrono::Duration::days(i as i64), p));
        }

        let ew = ElliottWave::new(3);
        let signals = ew.evaluate("TEST", &bars).await;
        assert!(!signals.is_empty(), "Expected ElliottWave swing turn signals");
        assert!(signals.iter().any(|s| s.direction == SignalDirection::Buy));
        assert!(signals.iter().any(|s| s.direction == SignalDirection::Sell));

        let ew_zero = ElliottWave::new(0);
        assert!(ew_zero.evaluate("TEST", &bars).await.is_empty());
    }
}
