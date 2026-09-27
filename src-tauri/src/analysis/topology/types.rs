//! Data types for Market Topology analysis.
//!
//! These types represent the output of the topology module:
//! ranking, correlation, network graph (MST), centrality metrics,
//! and regime information for a universe of assets.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Minimum Spanning Tree (MST) edge connecting two assets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MstEdge {
    pub source: String,
    pub target: String,
    pub weight: f64,      // Mantegna distance d_ij = sqrt(2*(1 - rho))
    pub correlation: f64, // Pearson correlation rho_ij
}

/// Centrality metrics for a node in the asset network.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NodeCentrality {
    pub symbol: String,
    pub degree: usize,
    pub betweenness: f64, // Normalized betweenness in [0, 1]
    pub is_hub: bool,
}

/// Macro-topological network metrics.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TopologyMetrics {
    pub normalized_tree_length: f64, // L_MST = (1 / (N - 1)) * sum(d_ij)
    pub hub_symbol: String,
    pub avg_correlation: f64,
    pub stress_status: String, // "Contracción / Estrés Elevado", "Moderado / Transición", "Diversificación Amplia / Saludable"
    pub window_days: usize,
}

/// Momentum and volatility ranking for a single asset.
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

/// N×N correlation matrix for the universe of assets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationMatrix {
    pub symbols: Vec<String>,
    pub correlations: Vec<Vec<f64>>,
}

/// Identified market regime information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegimeInfo {
    pub regime: String,
    pub description: String,
    pub affected_symbols: Vec<String>,
}

/// Complete topology analysis report.
///
/// Aggregates ranking, correlation, network topology (MST), centrality,
/// HRP clustering, and regime analysis into a single output structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyReport {
    pub date: NaiveDate,
    pub universe_size: usize,
    pub rankings: Vec<AssetRanking>,
    pub correlations: CorrelationMatrix,
    pub regimes: Vec<RegimeInfo>,
    #[serde(default)]
    pub mst_edges: Vec<MstEdge>,
    #[serde(default)]
    pub centrality: Vec<NodeCentrality>,
    #[serde(default)]
    pub metrics: Option<TopologyMetrics>,
    #[serde(default)]
    pub hrp_order: Vec<String>,
}
