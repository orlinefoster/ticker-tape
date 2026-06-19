//! Relative Performance Analysis Module
//!
//! Pipeline position: 5/6 — after ElliottWave, before Portfolio+MoneyManagement.
//!
//! Compares the performance of assets within a user-defined universe
//! against a benchmark and each other. Identifies leaders, laggards,
//! and rotation signals.

mod ranking;
pub mod types;

use async_trait::async_trait;
use anyhow::Result;

use crate::analysis::{AnalysisModule, DataRequirement, ModuleContext, ModuleOutput};
use crate::db::market_data_repo::MarketDataRepository;
use serde_json::Value;

use types::{RelativePerfOutput, RelativePerfReport};

/// Default universe for relative performance.
const DEFAULT_SYMBOLS: &[&str] = &["SPY", "QQQ", "TLT", "GLD", "DBC"];
const DEFAULT_BENCHMARK: &str = "SPY";

/// Relative Performance analysis module.
#[derive(Default)]
pub struct RelativePerfModule;

#[async_trait]
impl AnalysisModule for RelativePerfModule {
    fn name(&self) -> &str {
        "relative-perf"
    }

    fn description(&self) -> &str {
        "Relative strength ranking and benchmark comparison"
    }

    fn requirements(&self) -> Vec<DataRequirement> {
        DEFAULT_SYMBOLS
            .iter()
            .map(|&s| DataRequirement {
                symbol: s.to_string(),
                range: "2y".to_string(),
                description: format!("{} prices for relative strength", s),
            })
            .collect()
    }

    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>> {
        let today = chrono::Utc::now().date_naive();
        let from = (today - chrono::Duration::days(730)).format("%Y-%m-%d").to_string();
        let to = today.format("%Y-%m-%d").to_string();

        let symbols: Vec<&str> = if ctx.symbols.is_empty() {
            DEFAULT_SYMBOLS.to_vec()
        } else {
            ctx.symbols.iter().map(|s| s.as_str()).collect()
        };

        // Fetch price data for each symbol
        let mut price_data: Vec<(String, Vec<f64>)> = Vec::new();
        for &symbol in &symbols {
            match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                Ok(bars) if !bars.is_empty() => {
                    let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
                    price_data.push((symbol.to_string(), closes));
                }
                Ok(_) => tracing::warn!("[RelativePerf] No data for {}", symbol),
                Err(e) => tracing::warn!("[RelativePerf] Error fetching {}: {}", symbol, e),
            }
        }

        if price_data.is_empty() {
            anyhow::bail!("Relative performance requires at least one symbol with data");
        }

        let benchmark = DEFAULT_BENCHMARK;
        let rankings = ranking::compute_relative_strength(&price_data, benchmark);

        let rotation_score = if rankings.len() > 1 {
            let scores: Vec<f64> = rankings.iter().map(|r| r.composite_rs).collect();
            let mean = scores.iter().sum::<f64>() / scores.len() as f64;
            let variance = scores.iter().map(|s| (s - mean).powi(2)).sum::<f64>() / scores.len() as f64;
            variance.sqrt() // std deviation = rotation intensity
        } else {
            0.0
        };

        let report = RelativePerfReport {
            date: today,
            benchmark: benchmark.to_string(),
            universe_size: price_data.len(),
            rankings,
        };

        let top = report.rankings.first();
        let bottom = report.rankings.last();

        Ok(Box::new(RelativePerfOutput {
            benchmark: benchmark.to_string(),
            symbol_count: report.rankings.len(),
            top_performer: top.map(|r| r.symbol.clone()).unwrap_or_default(),
            bottom_performer: bottom.map(|r| r.symbol.clone()).unwrap_or_default(),
            rotation_score,
        }))
    }
}

#[async_trait]
impl ModuleOutput for RelativePerfOutput {
    fn as_json(&self) -> Value {
        serde_json::to_value(self).unwrap_or_default()
    }

    fn module_name(&self) -> &str {
        "relative-perf"
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_name_and_description() {
        let m = RelativePerfModule;
        assert_eq!(m.name(), "relative-perf");
        assert!(!m.description().is_empty());
    }

    #[test]
    fn test_requirements_non_empty() {
        let m = RelativePerfModule;
        let reqs = m.requirements();
        assert!(!reqs.is_empty());
        assert!(reqs.iter().any(|r| r.symbol == "SPY"));
    }

    #[test]
    fn test_default_symbols_contains_benchmark() {
        assert!(DEFAULT_SYMBOLS.contains(&DEFAULT_BENCHMARK));
    }
}
