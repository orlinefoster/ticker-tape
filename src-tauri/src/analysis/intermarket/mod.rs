//! Intermarket Analysis Module
//!
//! Determines the current economic cycle phase and John Murphy 6-Stage status
//! by analyzing relationships between stocks, bonds, commodities, currencies,
//! and credit spreads.
//!
//! Pipeline position: 1/6 — this is the foundational macro analysis.

mod cycle;
mod ratios;

use crate::analysis::{AnalysisModule, DataRequirement, ModuleContext, ModuleOutput};
use crate::db::market_data_repo::MarketDataRepository;
use async_trait::async_trait;
use anyhow::Result;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use cycle::{
    detect_murphy_cycle, detect_phase, HistoricalCycleBand, LeadingLaggingStatus, MarketPhase,
    MurphyCycleResult, StageScore, TacticalAssetAllocation,
};
pub use ratios::{
    compute_extended_ratios, compute_key_ratios, IntermarketCorrelation, KeyRatios,
    MacroRatioItem, NormalizedAssetSeries, NormalizedPoint, TrendDirection,
};

/// Symbols tracked for intermarket macro analysis
const REQUIRED_SYMBOLS: &[&str] = &[
    "SPY",  // US Large Cap Equities
    "TLT",  // 20Y+ Long-Term US Treasuries
    "DBC",  // Commodity Index
    "GLD",  // Gold Physical Trust
    "HYG",  // High Yield Corporate Bonds
    "BTC",  // Bitcoin (Crypto Liquidity Proxy)
    "XLF",  // Financials Sector
    "XLE",  // Energy Sector
    "XLK",  // Technology Sector
    "QQQ",  // Nasdaq 100
    "AGG",  // US Aggregate Bond Index
    "DXY",  // US Dollar Index
    "UUP",  // Invesco DB US Dollar Bullish Fund
    "LQD",  // Investment Grade Corporate Bonds
    "CPER", // US Copper Index Fund
    "TIP",  // TIPS Inflation Protected Bonds
    "SHY",  // 1-3 Year Treasury Bonds
    "XLI",  // Industrials Sector
    "XLV",  // Healthcare Sector
    "XLP",  // Consumer Staples Sector
    "XLY",  // Consumer Discretionary Sector
];

/// Complete intermarket analysis output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermarketReport {
    pub date: NaiveDate,
    pub phase: MarketPhase,
    pub stage: u8,
    pub stage_name: String,
    pub stage_description: String,
    pub confidence: f64,
    pub stage_scores: Vec<StageScore>,
    pub leaders: LeadingLaggingStatus,
    pub tactical_allocation: Vec<TacticalAssetAllocation>,
    pub indicators: Vec<IndicatorResult>,
    pub key_ratios: KeyRatios,
    pub macro_ratios: Vec<MacroRatioItem>,
    pub normalized_series: Vec<NormalizedAssetSeries>,
    pub correlation_matrix: IntermarketCorrelation,
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
        "John Murphy 6-Stage Intermarket Cycle & Macro Asset Allocation Engine"
    }

    fn requirements(&self) -> Vec<DataRequirement> {
        REQUIRED_SYMBOLS.iter().map(|&s| DataRequirement {
            symbol: s.to_string(),
            range: "2y".to_string(),
            description: format!("{} price series for macro intermarket analysis", s),
        }).collect()
    }

    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>> {
        let today = chrono::Utc::now().date_naive();
        let from = (today - chrono::Duration::days(730)).to_string();
        let to = today.to_string();

        // 1. Fetch data for all available symbols
        let mut dated_data: Vec<(String, Vec<(NaiveDate, f64)>)> = Vec::new();
        let mut price_data: Vec<(String, Vec<f64>)> = Vec::new();

        for &symbol in REQUIRED_SYMBOLS {
            match MarketDataRepository::get_bars(&ctx.db, symbol, &from, &to).await {
                Ok(bars) if !bars.is_empty() => {
                    let dated_bars: Vec<(NaiveDate, f64)> = bars.iter().map(|b| (b.date, b.close)).collect();
                    let closes: Vec<f64> = bars.iter().map(|b| b.close).collect();
                    dated_data.push((symbol.to_string(), dated_bars));
                    price_data.push((symbol.to_string(), closes));
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!("[Intermarket] No data for {}: {}", symbol, e);
                }
            }
        }

        if price_data.len() < 3 {
            anyhow::bail!("El análisis intermarket requiere al menos 3 activos cargados (ej. SPY, TLT, DBC/GLD)");
        }

        // 2. Compute extended key ratios, time series, normalized curves & correlations
        let (key_ratios, macro_ratios, normalized_series, correlation_matrix) =
            ratios::compute_extended_ratios(&dated_data)?;

        // 3. Evaluate John Murphy cycle stage and macro phase
        let cycle_res = cycle::detect_murphy_cycle(&price_data, &key_ratios);

        // 4. Build comprehensive narrative
        let narrative = build_narrative(
            &cycle_res.stage_name,
            &cycle_res.stage_description,
            &cycle_res.leaders.summary,
            &cycle_res.indicators,
            cycle_res.confidence,
        );

        let report = IntermarketReport {
            date: today,
            phase: cycle_res.phase,
            stage: cycle_res.stage,
            stage_name: cycle_res.stage_name,
            stage_description: cycle_res.stage_description,
            confidence: cycle_res.confidence,
            stage_scores: cycle_res.stage_scores,
            leaders: cycle_res.leaders,
            tactical_allocation: cycle_res.tactical_allocation,
            indicators: cycle_res.indicators,
            key_ratios,
            macro_ratios,
            normalized_series,
            correlation_matrix,
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

fn build_narrative(
    stage_name: &str,
    stage_desc: &str,
    leaders_summary: &str,
    indicators: &[IndicatorResult],
    confidence: f64,
) -> String {
    let bullish = indicators.iter().filter(|i| i.signal == "bullish").count();
    let bearish = indicators.iter().filter(|i| i.signal == "bearish").count();
    let total = indicators.len();

    format!(
        "{}\n\n{}\n{}\n\nSeñales Macro: {}/{} alcistas, {}/{} bajistas | Confianza de Modelo: {:.0}%.",
        stage_name, stage_desc, leaders_summary, bullish, total, bearish, total, confidence * 100.0
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert!(reqs.iter().any(|r| r.symbol == "TLT"));
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

        let narrative = build_narrative("Etapa 2: Giro de Acciones", "Fase de expansión", "Las acciones lideran.", &indicators, 0.85);
        assert!(narrative.contains("Etapa 2"));
        assert!(narrative.contains("85%"));
    }
}
