//! Cycle Phase Detection
//!
//! Determines the current economic cycle phase by matching indicator
//! scores against expected profiles for each cycle phase.

use serde::{Deserialize, Serialize};
use super::ratios::{KeyRatios, TrendDirection};

/// Market cycle phases
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MarketPhase {
    /// Stocks rising, bonds falling, commodities stable → improving fundamentals
    EarlyExpansion,
    /// Stocks still up, commodities surging, bonds falling → late cycle
    LateExpansion,
    /// Stocks volatile/peaking, bonds start rising, commodities at highs
    Peak,
    /// Stocks falling, bonds rallying, commodities crashing
    Contraction,
    /// Everything bottoming, bonds still strong, value emerging
    Trough,
}

impl MarketPhase {
    pub fn label(&self) -> &str {
        match self {
            MarketPhase::EarlyExpansion => "Expansión Temprana",
            MarketPhase::LateExpansion => "Expansión Tardía",
            MarketPhase::Peak => "Pico de Ciclo",
            MarketPhase::Contraction => "Contracción",
            MarketPhase::Trough => "Fondo de Ciclo",
        }
    }

    pub fn emoji(&self) -> &str {
        match self {
            MarketPhase::EarlyExpansion => "🌱",
            MarketPhase::LateExpansion => "🌊",
            MarketPhase::Peak => "⛰️",
            MarketPhase::Contraction => "📉",
            MarketPhase::Trough => "🪨",
        }
    }
}

/// Detect the current cycle phase by matching indicator scores against
/// expected profiles for each phase.
///
/// Uses weighted dot product similarity: actual indicator scores × expected profile.
#[allow(unused_variables)]
pub fn detect_phase(
    price_data: &[(String, Vec<f64>)],
    ratios: &KeyRatios,
) -> (MarketPhase, f64, Vec<super::IndicatorResult>) {
    let mut indicators = Vec::new();

    // Score each indicator (-1 to 1 scale)
    let sb_score = score_stock_bond(ratios);
    indicators.push(super::IndicatorResult {
        name: "Stock/Bond Ratio".into(),
        value: ratios.stock_bond,
        signal: signal_from_score(sb_score),
        weight: 1.0,
        description: format!("SPY/TLT trend: {}. Apetito por riesgo.", ratios.stock_bond_trend),
    });

    let cd_score = score_cyclical_defensive(ratios);
    indicators.push(super::IndicatorResult {
        name: "Cyclical/Defensive".into(),
        value: ratios.cyclical_defensive,
        signal: signal_from_score(cd_score),
        weight: 0.9,
        description: format!("Sectores cíclicos vs defensivos: {}.", ratios.cyclical_defensive_trend),
    });

    let cb_score = score_commodity_bond(ratios);
    indicators.push(super::IndicatorResult {
        name: "Commodity/Bond".into(),
        value: ratios.commodity_bond,
        signal: signal_from_score(cb_score),
        weight: 0.8,
        description: "Presiones inflacionarias vs refugio.".to_string(),
    });

    let dxy_score = score_dollar(ratios);
    indicators.push(super::IndicatorResult {
        name: "Dollar Trend".into(),
        value: ratios.dollar_ratio,
        signal: signal_from_score(dxy_score),
        weight: 0.6,
        description: format!("Índice dólar: {}.", ratios.dollar_trend),
    });

    // Actual scores vector [sb, cd, cb, dxy]
    let actual = [sb_score, cd_score, cb_score, dxy_score];

    // Expected profiles for each phase.
    // Each value: how we expect that indicator to behave in that phase.
    // Positive = bullish for risk assets, Negative = bearish for risk assets
    let profiles: [(MarketPhase, [f64; 4]); 5] = [
        (MarketPhase::EarlyExpansion, [ 0.8,  0.7,  0.2,  0.3]),  // stocks↑ cycl↑  comm∼  dxy∼
        (MarketPhase::LateExpansion,  [ 0.5,  0.3,  0.8, -0.2]),  // stocks↑ cycl∼  comm↑  dxy↓
        (MarketPhase::Peak,           [-0.3, -0.5,  0.6,  0.3]),  // stocks↓ cycl↓  comm↑  dxy↑
        (MarketPhase::Contraction,    [-0.7, -0.8, -0.6,  0.5]),  // stocks↓↓ cycl↓↓ comm↓  dxy↑
        (MarketPhase::Trough,         [ 0.2, -0.6, -0.5, -0.3]),  // stocks∼ cycl↓  comm↓  dxy↓
    ];

    let weights = [1.0, 0.9, 0.8, 0.6];
    let total_weight: f64 = weights.iter().sum();

    let mut best_phase = MarketPhase::EarlyExpansion;
    let mut best_score = f64::NEG_INFINITY;

    for (phase, profile) in &profiles {
        // Weighted dot product: positive = aligned, negative = opposed
        let mut score = 0.0;
        for j in 0..4 {
            score += weights[j] * actual[j] * profile[j];
        }
        score /= total_weight;

        if score > best_score {
            best_score = score;
            best_phase = *phase;
        }
    }

    // Normalize best_score from ~[-1, 1] to [0, 1] for confidence
    let confidence = ((best_score + 1.0) / 2.0).clamp(0.0, 1.0);

    (best_phase, confidence, indicators)
}

// ── Scoring functions ────────────────────────────────────────────────────

fn score_stock_bond(ratios: &KeyRatios) -> f64 {
    match ratios.stock_bond_trend {
        TrendDirection::Rising => 0.8,
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => -0.7,
    }
}

fn score_cyclical_defensive(ratios: &KeyRatios) -> f64 {
    match ratios.cyclical_defensive_trend {
        TrendDirection::Rising => 0.7,
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => -0.8,
    }
}

fn score_commodity_bond(ratios: &KeyRatios) -> f64 {
    match ratios.commodity_bond_trend {
        TrendDirection::Rising => 0.6,
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => -0.6,
    }
}

fn score_dollar(ratios: &KeyRatios) -> f64 {
    match ratios.dollar_trend {
        TrendDirection::Rising => -0.4,  // strong dollar = headwind for EM/commodities
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => 0.5,   // weak dollar = tailwind for risk
    }
}

fn signal_from_score(score: f64) -> String {
    if score > 0.2 {
        "bullish".to_string()
    } else if score < -0.2 {
        "bearish".to_string()
    } else {
        "neutral".to_string()
    }
}

// ── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::intermarket::ratios::TrendDirection;

    fn make_ratios(sb_t: TrendDirection, cd_t: TrendDirection, cb_t: TrendDirection, d_t: TrendDirection) -> KeyRatios {
        KeyRatios {
            stock_bond: 1.0,
            stock_bond_trend: sb_t,
            cyclical_defensive: 1.0,
            cyclical_defensive_trend: cd_t,
            commodity_bond: 1.0,
            commodity_bond_trend: cb_t,
            dollar_ratio: 1.0,
            dollar_trend: d_t,
        }
    }

    #[test]
    fn test_detect_expansion() {
        // Rising stocks, rising cyclicals, mild commodities, weak dollar
        let r = make_ratios(TrendDirection::Rising, TrendDirection::Rising, TrendDirection::Rising, TrendDirection::Falling);
        let (phase, confidence, indicators) = detect_phase(&[], &r);
        assert!(matches!(phase, MarketPhase::EarlyExpansion | MarketPhase::LateExpansion));
        assert!(confidence > 0.3);
        assert_eq!(indicators.len(), 4);
    }

    #[test]
    fn test_detect_contraction() {
        // Falling stocks, falling cyclicals, falling commodities, rising dollar
        let r = make_ratios(TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Rising);
        let (phase, confidence, _) = detect_phase(&[], &r);
        assert!(matches!(phase, MarketPhase::Contraction | MarketPhase::Trough));
        assert!(confidence > 0.3);
    }

    #[test]
    fn test_detect_peak() {
        // Weakening stocks, weakening cyclicals, high commodities, rising dollar
        let r = make_ratios(TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Rising, TrendDirection::Rising);
        let (phase, _, _) = detect_phase(&[], &r);
        assert!(matches!(phase, MarketPhase::Peak | MarketPhase::LateExpansion));
    }

    #[test]
    fn test_phase_labels() {
        assert_eq!(MarketPhase::EarlyExpansion.label(), "Expansión Temprana");
        assert_eq!(MarketPhase::Contraction.label(), "Contracción");
        assert_eq!(MarketPhase::Peak.emoji(), "⛰️");
    }

    #[test]
    fn test_all_neutral_is_early_expansion() {
        let r = make_ratios(TrendDirection::Sideways, TrendDirection::Sideways, TrendDirection::Sideways, TrendDirection::Sideways);
        let (phase, _, _) = detect_phase(&[], &r);
        // All neutral should default to something (no crash)
        assert!(matches!(phase, MarketPhase::EarlyExpansion | MarketPhase::LateExpansion));
    }
}
