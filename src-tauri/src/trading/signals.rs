//! Signal generation and aggregation
//!
//! Combines signals from multiple strategies, applies filters,
//! and produces actionable trading decisions.

use crate::trading::models::Signal;

/// Weighted signal aggregator
pub struct SignalAggregator {
    pub min_strength: f64,
    pub require_convergence: bool,
}

impl SignalAggregator {
    pub fn new(min_strength: f64, require_convergence: bool) -> Self {
        Self {
            min_strength,
            require_convergence,
        }
    }

    /// Aggregate signals from multiple strategies
    pub fn aggregate(&self, signals: Vec<Signal>) -> Vec<Signal> {
        // Filter by minimum strength
        let filtered: Vec<Signal> = signals
            .into_iter()
            .filter(|s| s.strength >= self.min_strength)
            .collect();

        // TODO: Implement more sophisticated aggregation
        // - Consensus scoring
        // - Time decay
        // - Volatility adjustment
        filtered
    }
}
