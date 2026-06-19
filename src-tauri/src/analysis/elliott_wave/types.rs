//! Data types for Elliott Wave analysis.
//!
//! Defines wave labels, degrees, and the complete analysis report.
//! These types are persisted in SQLite so wave counts survive restarts.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Degree of a wave in the Elliott Wave hierarchy.
///
/// From largest (Grand Supercycle) to smallest (Subminuette).
/// The module primarily works with Primary → Subminuette.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WaveDegree {
    GrandSupercycle,
    Supercycle,
    Cycle,
    Primary,
    Intermediate,
    Minor,
    Minute,
    Minuette,
    Subminuette,
}

impl WaveDegree {
    /// All degrees from largest to smallest.
    pub const ALL: &'static [WaveDegree] = &[
        WaveDegree::GrandSupercycle,
        WaveDegree::Supercycle,
        WaveDegree::Cycle,
        WaveDegree::Primary,
        WaveDegree::Intermediate,
        WaveDegree::Minor,
        WaveDegree::Minute,
        WaveDegree::Minuette,
        WaveDegree::Subminuette,
    ];

    pub fn as_str(&self) -> &'static str {
        match self {
            WaveDegree::GrandSupercycle => "grand-supercycle",
            WaveDegree::Supercycle => "supercycle",
            WaveDegree::Cycle => "cycle",
            WaveDegree::Primary => "primary",
            WaveDegree::Intermediate => "intermediate",
            WaveDegree::Minor => "minor",
            WaveDegree::Minute => "minute",
            WaveDegree::Minuette => "minuette",
            WaveDegree::Subminuette => "subminuette",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        Self::ALL.iter().find(|d| d.as_str() == s).copied()
    }
}

/// A single identified wave with label and price/time boundaries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveLabel {
    pub id: Option<i64>,
    pub symbol: String,
    pub timeframe: String,
    pub wave_degree: String,
    pub wave_label: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub price_start: Option<f64>,
    pub price_end: Option<f64>,
    pub confidence: f64,
    pub is_automatic: bool,
    pub notes: Option<String>,
}

/// Result of an Elliott Wave counting session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElliottReport {
    pub symbol: String,
    pub timeframe: String,
    pub counted_at: NaiveDate,
    pub impulse_waves: Vec<WaveLabel>,     // 1-2-3-4-5
    pub corrective_waves: Vec<WaveLabel>,  // A-B-C (or W-X-Y)
    pub clusters: Vec<FibCluster>,         // Fibonacci price targets
    pub confidence: f64,                   // Overall count confidence
}

/// A Fibonacci cluster — confluence of price targets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FibCluster {
    pub direction: String,         // "up" or "down"
    pub price_target: f64,
    pub sources: Vec<String>,      // e.g. ["1.618 of wave 1", "0.618 of wave 1-5"]
    pub strength: f64,             // 0.0 – 1.0 (how many sources converge)
}

/// Summary for AnalysisModule output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElliottWaveOutput {
    pub symbol: String,
    pub wave_count: usize,
    pub confidence: f64,
    pub clusters: Vec<FibCluster>,
}
