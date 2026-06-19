//! Trading strategies module
//!
//! Each strategy implements the Strategy trait and can be
//! composed, backtested, and executed by the engine.

use crate::trading::models::{OHLCVBar, Signal};

/// The core strategy trait — any strategy must implement this
#[async_trait::async_trait]
pub trait Strategy: Send + Sync {
    fn name(&self) -> &str;
    async fn evaluate(&self, symbol: &str, bars: &[OHLCVBar]) -> Vec<Signal>;
}

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
