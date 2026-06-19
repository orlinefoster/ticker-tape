//! Market Topology Module
//!
//! Pipeline position: 2/6 — after Intermarket, before MarketAccess.
//!
//! Analyzes a user-defined universe of symbols and produces:
//! - Multi-window momentum rankings with percentile scoring
//! - Pairwise Pearson correlation matrix (63-day window)
//! - Market regime detection (risk-on, risk-off, divergent, normal)

mod correlations;
mod ranking;
mod regimes;
pub mod types;

use crate::analysis::{AnalysisModule, DataRequirement, ModuleContext, ModuleOutput};
use crate::db::market_data_repo::MarketDataRepository;
use async_trait::async_trait;
use anyhow::Result;
use serde_json::Value;

pub use types::{AssetRanking, CorrelationMatrix, RegimeInfo, TopologyReport};

/// Default symbols used when the caller provides an empty list.
const DEFAULT_SYMBOLS: &[&str] = &["SPY", "QQQ", "TLT", "GLD", "DBC", "BTC"];

/// Market Topology analysis module
///
/// Analyzes a user-defined universe of symbols and produces a topology
/// report containing rankings, correlations, and regime information.
#[derive(Default)]
pub struct TopologyModule;

#[async_trait]
impl AnalysisModule for TopologyModule {
    fn name(&self) -> &str {
        "topology"
    }

    fn description(&self) -> &str {
        "Market topology: momentum rankings, correlations, and regime detection"
    }

    fn requirements(&self) -> Vec<DataRequirement> {
        DEFAULT_SYMBOLS
            .iter()
            .map(|&s| DataRequirement {
                symbol: s.to_string(),
                range: "2y".to_string(),
                description: format!("{} price data for topology analysis", s),
            })
            .collect()
    }

    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>> {
        let today = chrono::Utc::now().date_naive();
        let from = (today - chrono::Duration::days(730)).format("%Y-%m-%d").to_string();
        let to = today.format("%Y-%m-%d").to_string();

        // Determine which symbols to analyze.
        let symbols: Vec<&str> = if ctx.symbols.is_empty() {
            DEFAULT_SYMBOLS.to_vec()
        } else {
            ctx.symbols.iter().map(|s| s.as_str()).collect()
        };

        // Fetch price data for each symbol.
        let mut price_data: Vec<(String, Vec<f64>)> = Vec::new();
        for &symbol in &symbols {
            match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                Ok(bars) => {
                    let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
                    if !closes.is_empty() {
                        price_data.push((symbol.to_string(), closes));
                    }
                }
                Err(e) => {
                    tracing::warn!("[Topology] No data for {}: {}", symbol, e);
                }
            }
        }

        if price_data.is_empty() {
            anyhow::bail!("Topology analysis requires at least one symbol with data");
        }

        // Compute rankings.
        let rankings = ranking::compute_rankings(&price_data);

        // Compute correlation matrices.
        let correlations = correlations::compute_correlations(&price_data);

        // Detect market regimes.
        let market_corrs = correlations::correlation_to_market(&price_data);
        let regimes = regimes::detect_regimes(&price_data, &market_corrs);

        let report = TopologyReport {
            date: today,
            universe_size: price_data.len(),
            rankings,
            correlations,
            regimes,
        };

        Ok(Box::new(report))
    }
}

#[async_trait]
impl ModuleOutput for TopologyReport {
    fn as_json(&self) -> Value {
        serde_json::to_value(self).unwrap_or_default()
    }

    fn module_name(&self) -> &str {
        "topology"
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[tokio::test]
    async fn test_module_name_and_description() {
        let m = TopologyModule;
        assert_eq!(m.name(), "topology");
        assert!(!m.description().is_empty());
    }

    #[test]
    fn test_requirements_non_empty() {
        let m = TopologyModule;
        let reqs = m.requirements();
        assert!(!reqs.is_empty());
        assert!(reqs.iter().any(|r| r.symbol == "SPY"));
        assert!(reqs.iter().any(|r| r.symbol == "BTC"));
    }

    #[test]
    fn test_default_symbols() {
        assert!(DEFAULT_SYMBOLS.contains(&"SPY"));
        assert!(DEFAULT_SYMBOLS.contains(&"BTC"));
        assert_eq!(DEFAULT_SYMBOLS.len(), 6);
    }

    #[test]
    fn test_topology_report_serialization() {
        let report = TopologyReport {
            date: NaiveDate::from_ymd_opt(2026, 6, 19).unwrap(),
            universe_size: 2,
            rankings: vec![
                AssetRanking {
                    symbol: "SPY".to_string(),
                    returns_1w: 0.01,
                    returns_1m: 0.02,
                    returns_3m: 0.05,
                    returns_6m: 0.08,
                    returns_1y: 0.12,
                    percentile_rank: 100.0,
                    volatility: 0.15,
                    momentum_score: 0.03,
                },
                AssetRanking {
                    symbol: "QQQ".to_string(),
                    returns_1w: -0.01,
                    returns_1m: 0.01,
                    returns_3m: 0.03,
                    returns_6m: 0.06,
                    returns_1y: 0.10,
                    percentile_rank: 50.0,
                    volatility: 0.20,
                    momentum_score: 0.01,
                },
            ],
            correlations: CorrelationMatrix {
                symbols: vec!["SPY".to_string(), "QQQ".to_string()],
                correlations: vec![
                    vec![1.0, 0.85],
                    vec![0.85, 1.0],
                ],
            },
            regimes: vec![
                RegimeInfo {
                    regime: "risk-on".to_string(),
                    description: "Broad market strength.".to_string(),
                    affected_symbols: Vec::new(),
                },
            ],
        };

        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["universe_size"], 2);
        assert_eq!(json["rankings"][0]["symbol"], "SPY");
        assert_eq!(json["correlations"]["symbols"][0], "SPY");
        assert_eq!(json["regimes"][0]["regime"], "risk-on");
    }

    #[test]
    fn test_topology_report_module_output() {
        let report = TopologyReport {
            date: NaiveDate::from_ymd_opt(2026, 6, 19).unwrap(),
            universe_size: 0,
            rankings: vec![],
            correlations: CorrelationMatrix {
                symbols: vec![],
                correlations: vec![],
            },
            regimes: vec![],
        };

        assert_eq!(report.module_name(), "topology");
        let json = report.as_json();
        assert!(json.is_object());
    }
}
