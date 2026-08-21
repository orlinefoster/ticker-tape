//! Data types for Relative Performance analysis.
//!
//! Compares the performance of assets within a universe and
//! against a benchmark to identify leaders and laggards.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Relative strength score for a single asset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelativeStrength {
    pub symbol: String,
    /// Simple return across each window
    pub returns_1w: f64,
    pub returns_1m: f64,
    pub returns_3m: f64,
    pub returns_6m: f64,
    pub returns_1y: f64,
    /// Rank within universe (1 = best) for each window
    pub rank_1w: usize,
    pub rank_1m: usize,
    pub rank_3m: usize,
    pub rank_6m: usize,
    pub rank_1y: usize,
    /// Composite RS score (0–100). Higher = stronger relative performance.
    pub composite_rs: f64,
    /// Performance vs benchmark (%), e.g. returns_3m - benchmark_3m
    pub vs_benchmark_1m: f64,
    pub vs_benchmark_3m: f64,
    pub vs_benchmark_6m: f64,
}

/// Complete relative performance report for the universe.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelativePerfReport {
    pub date: NaiveDate,
    pub benchmark: String,
    pub universe_size: usize,
    pub rankings: Vec<RelativeStrength>,
    pub top_performer: String,
    pub bottom_performer: String,
    pub rotation_score: f64, // dispersion of RS scores (high = rotation happening)
}

