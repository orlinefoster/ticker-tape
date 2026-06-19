//! Elliott Wave Analysis Module
//!
//! Pipeline position: 4/6 — after MarketAccess, before RelativePerf.
//!
//! Identifies and persists Elliott Wave counts so the user never
//! loses their labelled waves between sessions.
//!
//! # Persistence flow
//!
//! 1. Module loads → checks `wave_labels` table for existing labels
//! 2. If labels exist → return them immediately (NO recount)
//! 3. User clicks "Recount" → delete old labels → run algorithm → store new
//! 4. User can manually add/edit/delete labels (survive restarts)

pub mod counting;
pub mod persistence;
pub mod types;

use async_trait::async_trait;
use anyhow::Result;

use crate::analysis::{AnalysisModule, DataRequirement, ModuleContext, ModuleOutput};
use crate::analysis::elliott_wave::persistence::WaveLabelRepository;
use crate::analysis::elliott_wave::types::{ElliottWaveOutput, FibCluster};
use crate::db::market_data_repo::MarketDataRepository;
use serde_json::Value;

/// Default symbols for Elliott Wave analysis.
const DEFAULT_SYMBOLS: &[&str] = &["SPY", "QQQ", "BTC"];

/// Elliott Wave analysis module.
///
/// Detects impulse/corrective waves and persists labels in SQLite.
#[derive(Default)]
pub struct ElliottWaveModule;

impl ElliottWaveModule {
    const TIMEFRAME: &'static str = "1d";
}

#[async_trait]
impl AnalysisModule for ElliottWaveModule {
    fn name(&self) -> &str {
        "elliott-wave"
    }

    fn description(&self) -> &str {
        "Elliott Wave count with persistent labels (no recount on reopen)"
    }

    fn requirements(&self) -> Vec<DataRequirement> {
        DEFAULT_SYMBOLS
            .iter()
            .map(|&s| DataRequirement {
                symbol: s.to_string(),
                range: "2y".to_string(),
                description: format!("{} daily prices for Elliott Wave analysis", s),
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

        let mut total_waves = 0;
        let mut best_confidence = 0.0_f64;
        let mut all_clusters: Vec<FibCluster> = Vec::new();

        for &symbol in &symbols {
            // 1. Check if labels already exist → skip recount
            let has_existing = WaveLabelRepository::has_labels(&ctx.db, symbol, Self::TIMEFRAME)
                .await
                .unwrap_or(false);

            if !has_existing {
                // 2. Fetch price data
                match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                    Ok(bars) if !bars.is_empty() => {
                        let dates: Vec<_> = bars.iter().map(|b| b.date).collect();
                        let closes: Vec<_> = bars.iter().map(|b| b.close).collect();

                        // 3. Count waves
                        let (impulse, corrective, clusters) =
                            counting::count_waves(symbol, &dates, &closes, Self::TIMEFRAME);

                        // 4. Persist labels
                        if !impulse.is_empty() || !corrective.is_empty() {
                            let all_labels: Vec<_> = impulse
                                .iter()
                                .chain(corrective.iter())
                                .cloned()
                                .collect();
                            if let Err(e) = WaveLabelRepository::save_labels(&ctx.db, &all_labels).await {
                                tracing::warn!("Failed to persist wave labels for {}: {}", symbol, e);
                            }
                        }

                        total_waves += impulse.len() + corrective.len();
                        if !impulse.is_empty() {
                            best_confidence = best_confidence.max(0.7);
                        }
                        all_clusters.extend(clusters);
                    }
                    Ok(_) => {
                        tracing::warn!("[ElliottWave] No price data for {}", symbol);
                    }
                    Err(e) => {
                        tracing::warn!("[ElliottWave] Error fetching {}: {}", symbol, e);
                    }
                }
            } else {
                tracing::debug!("[ElliottWave] Wave labels already exist for {} — skipping recount", symbol);
            }
        }

        Ok(Box::new(ElliottWaveOutput {
            symbol: symbols.join(","),
            wave_count: total_waves,
            confidence: best_confidence,
            clusters: all_clusters,
        }))
    }
}

#[async_trait]
impl ModuleOutput for ElliottWaveOutput {
    fn as_json(&self) -> Value {
        serde_json::to_value(self).unwrap_or_default()
    }

    fn module_name(&self) -> &str {
        "elliott-wave"
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
        let m = ElliottWaveModule;
        assert_eq!(m.name(), "elliott-wave");
        assert!(!m.description().is_empty());
    }

    #[test]
    fn test_requirements_non_empty() {
        let m = ElliottWaveModule;
        let reqs = m.requirements();
        assert!(!reqs.is_empty());
        assert!(reqs.iter().any(|r| r.symbol == "SPY"));
        assert!(reqs.iter().any(|r| r.symbol == "BTC"));
    }

    #[test]
    fn test_default_symbols() {
        assert!(DEFAULT_SYMBOLS.contains(&"SPY"));
        assert!(DEFAULT_SYMBOLS.contains(&"BTC"));
    }
}
