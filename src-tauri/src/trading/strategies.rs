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
// Moving Average Crossover (placeholder)
// ---------------------------------------------------------------------------

/// Moving Average Crossover strategy
pub struct MACrossover {
    pub fast_period: usize,
    pub slow_period: usize,
}

#[async_trait::async_trait]
impl Strategy for MACrossover {
    fn name(&self) -> &str {
        "MA Crossover"
    }

    async fn evaluate(&self, _symbol: &str, _bars: &[OHLCVBar]) -> Vec<Signal> {
        // TODO: Implement MA crossover logic
        Vec::new()
    }
}

// ---------------------------------------------------------------------------
// Elliott Wave (placeholder)
// ---------------------------------------------------------------------------

/// Elliott Wave pattern detector
pub struct ElliottWave {
    pub min_wave_length: usize,
}

#[async_trait::async_trait]
impl Strategy for ElliottWave {
    fn name(&self) -> &str {
        "Elliott Wave"
    }

    async fn evaluate(&self, _symbol: &str, _bars: &[OHLCVBar]) -> Vec<Signal> {
        // TODO: Implement Elliott Wave detection (ported from orlines-lab)
        Vec::new()
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
        if bars.len() < self.period {
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
                let strength = ((lower - bar.close) / lower).min(1.0).max(0.1);
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
                let strength = ((bar.close - upper) / upper).min(1.0).max(0.1);
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
        if closes.len() < self.period + 1 {
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
        if bars.len() < self.period + 1 {
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
                let strength = ((curr_rsi - self.oversold) / (50.0 - self.oversold))
                    .min(1.0)
                    .max(0.1);
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
                let strength = ((self.overbought - curr_rsi) / (self.overbought - 50.0))
                    .min(1.0)
                    .max(0.1);
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

    // -- Strategy trait tests --------------------------------------------------

    #[tokio::test]
    async fn test_macrossover_default_parameters() {
        let ma = MACrossover {
            fast_period: 10,
            slow_period: 30,
        };
        // Default impl returns empty.
        assert!(ma.parameters().is_empty());
    }
}
