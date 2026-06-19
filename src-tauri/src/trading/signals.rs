//! Signal generation and aggregation
//!
//! Combines signals from multiple strategies, applies filters,
//! and produces actionable trading decisions.

use std::collections::HashMap;

use chrono::NaiveDate;

use crate::trading::bar_collection::BarCollection;
use crate::trading::models::{Signal, SignalDirection};
use crate::trading::strategies::Strategy;

/// Weighted signal aggregator with strategy registry.
///
/// Registered strategies are called in order during [`analyze`](Self::analyze).
/// Each signal's strength is multiplied by the strategy's weight, then
/// signals are grouped by date + direction and their strengths summed.
/// Only groups whose total strength >= `min_strength` are returned,
/// sorted by strength descending.
pub struct SignalAggregator {
    pub min_strength: f64,
    pub require_convergence: bool,
    strategies: Vec<(Box<dyn Strategy>, f64)>,
}

impl SignalAggregator {
    pub fn new(min_strength: f64, require_convergence: bool) -> Self {
        Self {
            min_strength,
            require_convergence,
            strategies: Vec::new(),
        }
    }

    /// Register a strategy with a weight.
    ///
    /// Higher weight = more influence on the final consensus.
    pub fn add_strategy(&mut self, strategy: Box<dyn Strategy>, weight: f64) {
        self.strategies.push((strategy, weight));
    }

    /// Number of registered strategies.
    pub fn strategy_count(&self) -> usize {
        self.strategies.len()
    }

    /// Analyze bars through all registered strategies and produce a
    /// weighted-consensus signal list.
    ///
    /// 1. Each strategy evaluates the bars and emits signals.
    /// 2. Each signal's strength is multiplied by the strategy's weight.
    /// 3. Signals are grouped by `(date, direction)` and their weighted
    ///    strengths are summed.
    /// 4. Only groups with total strength >= `min_strength` are kept.
    /// 5. If a date has both a Buy and a Sell consensus signal, the
    ///    weaker one is dropped (highest-wins per date).
    /// 6. Results are sorted by strength descending.
    pub async fn analyze(&self, symbol: &str, bars: &BarCollection) -> Vec<Signal> {
        if self.strategies.is_empty() {
            return Vec::new();
        }

        // --- 1 / 2: gather weighted strengths per (date, direction) --------
        let mut consensus: HashMap<(NaiveDate, SignalDirection), f64> = HashMap::new();

        for (strategy, weight) in &self.strategies {
            let signals = strategy.evaluate(symbol, bars).await;
            for signal in signals {
                let date = signal.timestamp.date_naive();
                let entry = consensus
                    .entry((date, signal.direction))
                    .or_insert(0.0);
                *entry += signal.strength * weight;
            }
        }

        // --- 3 / 4: filter by min_strength ---------------------------------
        let mut results: Vec<(NaiveDate, SignalDirection, f64)> = consensus
            .into_iter()
            .filter(|(_, strength)| *strength >= self.min_strength)
            .map(|((date, dir), strength)| (date, dir, strength))
            .collect();

        // --- 5: per-date highest-wins ---------------------------------------
        if self.require_convergence {
            // Convergence mode: only the strongest signal per date survives.
            results.sort_by(|a, b| {
                a.0.cmp(&b.0) // date ascending
                    .then(b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal)) // strength desc
            });
            results.dedup_by(|a, b| a.0 == b.0);
        }
        // When require_convergence is false, keep all signals (may include
        // both Buy and Sell for the same date from different strategies).

        // --- 6: build final Signal list (sorted by strength desc) ----------
        results.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

        results
            .into_iter()
            .map(|(date, direction, strength)| {
                let naive = date
                    .and_hms_opt(0, 0, 0)
                    .expect("zero time always valid")
                    .and_utc();
                Signal {
                    symbol: symbol.to_string(),
                    direction,
                    strength,
                    timestamp: naive,
                    source: "consensus".to_string(),
                    metadata: serde_json::json!({}),
                }
            })
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use crate::trading::bar_collection::BarCollection;
    use crate::trading::models::OHLCVBar;
    use crate::trading::signals::SignalAggregator;
    use crate::trading::strategies::{BollingerBands, RSI};

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

    fn make_collection(closes: &[f64]) -> BarCollection {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let bars: Vec<_> = closes
            .iter()
            .enumerate()
            .map(|(i, &c)| {
                make_bar(
                    start + chrono::Duration::days(i as i64),
                    c,
                )
            })
            .collect();
        BarCollection::new(bars).unwrap()
    }

    #[tokio::test]
    async fn test_empty_registry() {
        let agg = SignalAggregator::new(0.5, false);
        let bars = make_collection(&[100.0; 30]);
        let signals = agg.analyze("TEST", &bars).await;
        assert!(signals.is_empty());
    }

    #[tokio::test]
    async fn test_single_strategy_signals_pass_through() {
        let mut agg = SignalAggregator::new(0.0, false);
        let bb = BollingerBands::new(20, 2.0);
        agg.add_strategy(Box::new(bb), 1.0);

        // Create a dip to trigger Bollinger buy signals.
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 5]);
        let bars = make_collection(&closes);

        let signals = agg.analyze("TEST", &bars).await;
        assert!(!signals.is_empty(), "Expected signals from BB dip");
        assert!(signals.iter().all(|s| s.symbol == "TEST"));
    }

    #[tokio::test]
    async fn test_min_strength_filter() {
        let mut agg = SignalAggregator::new(10.0, false); // very high threshold
        let bb = BollingerBands::new(20, 2.0);
        agg.add_strategy(Box::new(bb), 1.0);

        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 5]);
        let bars = make_collection(&closes);

        let signals = agg.analyze("TEST", &bars).await;
        // Individual BB signal strengths are at most 1.0 * weight (1.0) = 1.0,
        // so none should pass the 10.0 threshold.
        assert!(signals.is_empty());
    }

    #[tokio::test]
    async fn test_weighted_consensus() {
        // Use a more dramatic dip so both BB and RSI generate clear signals.
        let mut agg = SignalAggregator::new(0.01, false);
        let bb = BollingerBands::new(20, 2.0);
        let rsi = RSI::new(14, 70.0, 30.0);
        agg.add_strategy(Box::new(bb), 1.0);
        agg.add_strategy(Box::new(rsi), 1.0);

        // Strong dip: 25 bars at 100, then 10 bars at 60.
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[60.0; 10]); // deep dip
        closes.extend((0..10).map(|i| 60.0 + i as f64 * 4.0)); // recovery to 96
        let bars = make_collection(&closes);

        let signals = agg.analyze("TEST", &bars).await;
        // Should have some signals from the dip triggering both strategies.
        assert!(!signals.is_empty(), "Expected at least one consensus signal");
        // All signals should have the symbol we passed.
        assert!(signals.iter().all(|s| s.symbol == "TEST"));
    }

    #[tokio::test]
    async fn test_require_convergence_dedup() {
        let mut agg = SignalAggregator::new(0.0, true);
        let bb1 = BollingerBands::new(20, 2.0);
        let bb2 = BollingerBands::new(10, 1.5);
        agg.add_strategy(Box::new(bb1), 1.0);
        agg.add_strategy(Box::new(bb2), 1.0);

        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 5]);
        let bars = make_collection(&closes);

        let signals = agg.analyze("TEST", &bars).await;
        // In convergence mode each date should have at most one signal.
        let mut dates: Vec<_> = signals.iter().map(|s| s.timestamp.date_naive()).collect();
        dates.sort();
        dates.dedup();
        assert_eq!(
            dates.len(),
            signals.len(),
            "Each date should have at most one signal in convergence mode"
        );
    }

    #[tokio::test]
    async fn test_strategy_count() {
        let mut agg = SignalAggregator::new(0.0, false);
        assert_eq!(agg.strategy_count(), 0);
        agg.add_strategy(Box::new(BollingerBands::new(20, 2.0)), 1.0);
        assert_eq!(agg.strategy_count(), 1);
        agg.add_strategy(Box::new(RSI::new(14, 70.0, 30.0)), 1.0);
        assert_eq!(agg.strategy_count(), 2);
    }
}
