//! Intermarket Analysis Module
//!
//! Determines the current economic cycle phase by analyzing relationships
//! between stocks, bonds, commodities, currencies, and sectors.
//!
//! Pipeline position: 1/6 — this is the first analysis run.

mod cycle;
mod ratios;

use crate::analysis::{AnalysisModule, DataRequirement, ModuleContext, ModuleOutput};
use crate::db::market_data_repo::MarketDataRepository;
use async_trait::async_trait;
use anyhow::Result;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use cycle::MarketPhase;
pub use ratios::KeyRatios;

/// Symbols needed for intermarket analysis
const REQUIRED_SYMBOLS: &[&str] = &[
    "SPY",  // US equities
    "TLT",  // Long-term bonds
    "AGG",  // Aggregate bonds
    "DBC",  // Commodities
    "DXY",  // US Dollar index
    "XLF",  // Financials
    "XLE",  // Energy
    "XLV",  // Healthcare (defensive)
    "XLK",  // Technology
    "XLI",  // Industrials (cyclical)
    "XLP",  // Consumer staples (defensive)
    "XLY",  // Consumer discretionary (cyclical)
];

/// Complete intermarket analysis output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermarketReport {
    pub date: NaiveDate,
    pub phase: MarketPhase,
    pub confidence: f64,
    pub indicators: Vec<IndicatorResult>,
    pub key_ratios: KeyRatios,
    pub narrative: String,
}

/// Individual indicator result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndicatorResult {
    pub name: String,
    pub value: f64,
    pub signal: String,  // "bullish", "bearish", "neutral"
    pub weight: f64,
    pub description: String,
}

/// Intermarket analysis module
#[derive(Default)]
pub struct IntermarketModule;

#[async_trait]
impl AnalysisModule for IntermarketModule {
    fn name(&self) -> &str {
        "intermarket"
    }

    fn description(&self) -> &str {
        "Economic cycle phase detection via intermarket relationships"
    }

    fn requirements(&self) -> Vec<DataRequirement> {
        REQUIRED_SYMBOLS.iter().map(|&s| DataRequirement {
            symbol: s.to_string(),
            range: "2y".to_string(),
            description: format!("{} price data for intermarket analysis", s),
        }).collect()
    }

    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>> {
        let repo = MarketDataRepository;
        let today = chrono::Utc::now().date_naive();

        // 1. Fetch data for all required symbols
        let mut price_data: Vec<(String, Vec<f64>)> = Vec::new();
        for &symbol in REQUIRED_SYMBOLS {
            let from = (today - chrono::Duration::days(730)).to_string();
            let to = today.to_string();
            match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                Ok(bars) => {
                    let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
                    if !closes.is_empty() {
                        price_data.push((symbol.to_string(), closes));
                    }
                }
                Err(e) => {
                    tracing::warn!("[Intermarket] No data for {}: {}", symbol, e);
                }
            }
        }

        if price_data.len() < 4 {
            anyhow::bail!("Intermarket analysis requires at least SPY, TLT, DBC, and DXY data");
        }

        // 2. Compute key ratios
        let key_ratios = ratios::compute_key_ratios(&price_data)?;

        // 3. Evaluate cycle phase
        let (phase, confidence, indicators) = cycle::detect_phase(&price_data, &key_ratios);

        // 4. Build narrative
        let narrative = build_narrative(&phase, &indicators, confidence);

        let report = IntermarketReport {
            date: today,
            phase,
            confidence,
            indicators,
            key_ratios,
            narrative,
        };

        Ok(Box::new(report))
    }
}

#[async_trait]
impl ModuleOutput for IntermarketReport {
    fn as_json(&self) -> Value {
        serde_json::to_value(self).unwrap_or_default()
    }

    fn module_name(&self) -> &str {
        "intermarket"
    }
}

fn build_narrative(phase: &MarketPhase, indicators: &[IndicatorResult], confidence: f64) -> String {
    let bullish = indicators.iter().filter(|i| i.signal == "bullish").count();
    let bearish = indicators.iter().filter(|i| i.signal == "bearish").count();
    let total = indicators.len();

    let phase_desc = match phase {
        MarketPhase::EarlyExpansion => "Expansión temprana — mercado alcista con fundamentos mejorando.",
        MarketPhase::LateExpansion => "Expansión tardía — momentum alcista pero con riesgos crecientes.",
        MarketPhase::Peak => "Pico de ciclo — señales de agotamiento, cautela.",
        MarketPhase::Contraction => "Contracción — mercado bajista, refugio en bonos.",
        MarketPhase::Trough => "Fondo de ciclo — oportunidades de largo plazo emergiendo.",
    };

    format!(
        "{}\nSeñales: {}/{} alcistas, {}/{} bajistas.\nConfianza: {:.0}%.",
        phase_desc, bullish, total, bearish, total, confidence * 100.0
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    // Tests that need DB access are integration-level; unit tests don't need pool

    #[tokio::test]
    async fn test_module_name_and_description() {
        let m = IntermarketModule;
        assert_eq!(m.name(), "intermarket");
        assert!(!m.description().is_empty());
    }

    #[test]
    fn test_requirements_non_empty() {
        let m = IntermarketModule;
        let reqs = m.requirements();
        assert!(!reqs.is_empty());
        assert!(reqs.iter().any(|r| r.symbol == "SPY"));
    }

    #[test]
    fn test_narrative_coverage() {
        let indicators = vec![
            IndicatorResult {
                name: "Stock/Bond".into(),
                value: 1.5,
                signal: "bullish".into(),
                weight: 1.0,
                description: "".into(),
            },
        ];

        let narrative = build_narrative(&MarketPhase::EarlyExpansion, &indicators, 0.8);
        assert!(narrative.contains("Expansión temprana"));
        assert!(narrative.contains("80%"));

        let narrative2 = build_narrative(&MarketPhase::Contraction, &indicators, 0.6);
        assert!(narrative2.contains("Contracción"));
    }
}
