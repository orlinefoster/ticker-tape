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

use types::RelativePerfReport;

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

        let benchmark = ctx
            .parameters
            .get("benchmark")
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_BENCHMARK);

        let mut symbols: Vec<String> = if ctx.symbols.is_empty() {
            DEFAULT_SYMBOLS.iter().map(|&s| s.to_string()).collect()
        } else {
            ctx.symbols.clone()
        };

        if !symbols.iter().any(|s| s.eq_ignore_ascii_case(benchmark)) {
            symbols.push(benchmark.to_string());
        }

        // Fetch price data for each symbol, auto-fetching authentic data if cache miss
        let mut price_data: Vec<(String, Vec<f64>)> = Vec::new();
        let mut missing_symbols: Vec<String> = Vec::new();
        let from_date = today - chrono::Duration::days(730);

        for symbol in &symbols {
            let mut bars = match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                Ok(b) if !b.is_empty() => b,
                _ => Vec::new(),
            };

            if bars.is_empty() {
                // Try fetching authentic data from external provider (Yahoo Finance / Binance)
                match crate::trading::market_data::fetch_historical_data(symbol, from_date, today).await {
                    Ok(fetched) if !fetched.is_empty() => {
                        let _ = MarketDataRepository::upsert_bars(&ctx.db, &fetched).await;
                        bars = fetched;
                    }
                    Err(e) => {
                        tracing::warn!("[RelativePerf] No se pudieron descargar datos reales para {}: {}. Omitiendo sin inyectar mock.", symbol, e);
                        missing_symbols.push(symbol.to_string());
                    }
                    _ => {
                        missing_symbols.push(symbol.to_string());
                    }
                }
            }

            if !bars.is_empty() {
                let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
                price_data.push((symbol.to_string(), closes));
            }
        }

        if price_data.is_empty() {
            anyhow::bail!("Rendimiento relativo requiere al menos un activo con datos reales disponibles");
        }

        let rankings = ranking::compute_relative_strength(&price_data, benchmark);

        let rotation_score = if rankings.len() > 1 {
            let scores: Vec<f64> = rankings.iter().map(|r| r.composite_rs).collect();
            let mean = scores.iter().sum::<f64>() / scores.len() as f64;
            let variance = scores.iter().map(|s| (s - mean).powi(2)).sum::<f64>() / scores.len() as f64;
            variance.sqrt() // std deviation = rotation intensity
        } else {
            0.0
        };

        let top = rankings.first().map(|r| r.symbol.clone()).unwrap_or_default();
        let bottom = rankings.last().map(|r| r.symbol.clone()).unwrap_or_default();

        let report = RelativePerfReport {
            date: today,
            benchmark: benchmark.to_string(),
            universe_size: price_data.len(),
            rankings,
            top_performer: top,
            bottom_performer: bottom,
            rotation_score,
            missing_symbols,
        };

        Ok(Box::new(report))
    }
}

#[async_trait]
impl ModuleOutput for RelativePerfReport {
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

    #[test]
    fn test_compute_relative_strength_with_btc_benchmark() {
        let btc_closes = vec![60000.0, 61000.0, 62000.0, 63000.0, 64000.0, 65000.0];
        let eth_closes = vec![3000.0, 3100.0, 3300.0, 3400.0, 3600.0, 3900.0]; // Outperforming BTC
        let sol_closes = vec![150.0, 149.0, 148.0, 147.0, 146.0, 145.0]; // Underperforming BTC

        let price_data = vec![
            ("BTC".to_string(), btc_closes),
            ("ETH".to_string(), eth_closes),
            ("SOL".to_string(), sol_closes),
        ];

        let rankings = ranking::compute_relative_strength(&price_data, "BTC");
        assert_eq!(rankings.len(), 2);
        // ETH has higher returns than BTC and SOL
        assert_eq!(rankings[0].symbol, "ETH");
        assert!(rankings[0].composite_rs > rankings[1].composite_rs);
    }
}
