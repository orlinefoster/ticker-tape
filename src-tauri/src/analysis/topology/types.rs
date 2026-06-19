//! Data types for Market Topology analysis.
//!
//! These types represent the output of the topology module:
//! ranking, correlation, and regime information for a universe
//! of assets.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Complete topology analysis report
///
/// Aggregates ranking, correlation, and regime analysis into
/// a single output structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyReport {
    pub date: NaiveDate,
    pub universe_size: usize,
    pub rankings: Vec<AssetRanking>,
    pub correlations: CorrelationMatrix,
    pub regimes: Vec<RegimeInfo>,
}

/// Momentum and volatility ranking for a single asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetRanking {
    pub symbol: String,
    pub returns_1w: f64,
    pub returns_1m: f64,
    pub returns_3m: f64,
    pub returns_6m: f64,
    pub returns_1y: f64,
    pub percentile_rank: f64,
    pub volatility: f64,
    pub momentum_score: f64,
}

/// N×N correlation matrix for the universe of assets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationMatrix {
    pub symbols: Vec<String>,
    pub correlations: Vec<Vec<f64>>,
}

/// Identified market regime information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegimeInfo {
    pub regime: String,
    pub description: String,
    pub affected_symbols: Vec<String>,
}
