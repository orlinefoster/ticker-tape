//! Market regime detection for topology analysis.
//!
//! Identifies the current market regime by comparing individual asset
//! behaviour against the universe average and expected correlations.

use super::types::RegimeInfo;

/// Threshold: fraction of assets that must deviate from expected
/// correlation to trigger a "divergent" regime.
const DIVERGENT_THRESHOLD: f64 = 0.3;

/// Threshold: absolute correlation below this is considered "divergent"
/// from the market average.
const CORRELATION_DEVIATION: f64 = 0.4;

/// Threshold for "most assets positive" in risk-on detection.
const POSITIVE_RETURN_THRESHOLD: f64 = 0.6;

/// Threshold for "most assets negative" in risk-off detection.
const NEGATIVE_RETURN_THRESHOLD: f64 = 0.6;

/// Detect the current market regime from price data.
///
/// # Arguments
///
/// * `price_data` — Slice of `(symbol, closes)` tuples.
/// * `correlation_to_market` — Each asset's correlation to the
///   equal-weight universe average.
///
/// # Returns
///
/// A `Vec<RegimeInfo>` with one or more regime entries. The first entry
/// is the primary regime; additional entries may provide supplementary
/// context.
pub fn detect_regimes(
    price_data: &[(String, Vec<f64>)],
    correlation_to_market: &[(String, f64)],
) -> Vec<RegimeInfo> {
    if price_data.is_empty() {
        return vec![RegimeInfo {
            regime: "normal".to_string(),
            description: "No data available — insufficient universe for regime detection.".to_string(),
            affected_symbols: Vec::new(),
        }];
    }

    // Compute latest returns for each asset (1-month = ~21 trading days).
    let latest_returns: Vec<(String, f64)> = price_data
        .iter()
        .map(|(symbol, closes)| {
            let ret = if closes.len() > 21 {
                let current = closes[closes.len() - 1];
                let past = closes[closes.len() - 1 - 21];
                if past != 0.0 { (current - past) / past } else { 0.0 }
            } else {
                0.0
            };
            (symbol.clone(), ret)
        })
        .collect();

    let total = latest_returns.len() as f64;
    let positive_count = latest_returns.iter().filter(|(_, r)| *r > 0.0).count();
    let negative_count = latest_returns.iter().filter(|(_, r)| *r < 0.0).count();

    // Detect divergent assets: those with unusually low correlation to market.
    let divergent_symbols: Vec<String> = correlation_to_market
        .iter()
        .filter(|(_, corr)| corr.abs() < CORRELATION_DEVIATION)
        .map(|(s, _)| s.clone())
        .collect();

    let divergent_ratio = if total > 0.0 {
        divergent_symbols.len() as f64 / total
    } else {
        0.0
    };

    let mut regimes: Vec<RegimeInfo> = Vec::new();

    // Check for divergent regime first (it can coexist with risk-on/off).
    if divergent_ratio >= DIVERGENT_THRESHOLD {
        regimes.push(RegimeInfo {
            regime: "divergent".to_string(),
            description: format!(
                "{:.0}% of assets show weak correlation to the market average, indicating \
                 stock-picking regime. Individual selection matters more than beta exposure.",
                divergent_ratio * 100.0
            ),
            affected_symbols: divergent_symbols,
        });
    }

    // Determine the primary direction regime.
    let positive_ratio = if total > 0.0 {
        positive_count as f64 / total
    } else {
        0.0
    };
    let negative_ratio = if total > 0.0 {
        negative_count as f64 / total
    } else {
        0.0
    };

    if positive_ratio >= POSITIVE_RETURN_THRESHOLD {
        regimes.push(RegimeInfo {
            regime: "risk-on".to_string(),
            description: format!(
                "{:.0}% of assets are positive. Broad market strength with \
                 widespread risk appetite.",
                positive_ratio * 100.0
            ),
            affected_symbols: Vec::new(),
        });
    } else if negative_ratio >= NEGATIVE_RETURN_THRESHOLD {
        regimes.push(RegimeInfo {
            regime: "risk-off".to_string(),
            description: format!(
                "{:.0}% of assets are negative. Broad market weakness — \
                 defensive positioning warranted.",
                negative_ratio * 100.0
            ),
            affected_symbols: Vec::new(),
        });
    } else {
        regimes.push(RegimeInfo {
            regime: "normal".to_string(),
            description: "Mixed signals — no dominant directional bias. \
                          Market is in a balanced or rotational phase."
                .to_string(),
            affected_symbols: Vec::new(),
        });
    }

    regimes
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Generate an uptrend price series.
    fn uptrend(length: usize) -> Vec<f64> {
        (0..length).scan(100.0, |price, _| {
            *price *= 1.001;
            Some(*price)
        }).collect()
    }

    /// Generate a downtrend price series.
    fn downtrend(length: usize) -> Vec<f64> {
        (0..length).scan(100.0, |price, _| {
            *price *= 0.999;
            Some(*price)
        }).collect()
    }

    #[test]
    fn test_risk_on_detected() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), uptrend(200)),
            ("B".to_string(), uptrend(200)),
            ("C".to_string(), uptrend(200)),
            ("D".to_string(), uptrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.9),
            ("B".to_string(), 0.85),
            ("C".to_string(), 0.88),
            ("D".to_string(), 0.92),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        assert!(regimes.iter().any(|r| r.regime == "risk-on"), "expected risk-on regime");
    }

    #[test]
    fn test_risk_off_detected() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), downtrend(200)),
            ("B".to_string(), downtrend(200)),
            ("C".to_string(), downtrend(200)),
            ("D".to_string(), downtrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.9),
            ("B".to_string(), 0.85),
            ("C".to_string(), 0.88),
            ("D".to_string(), 0.92),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        assert!(regimes.iter().any(|r| r.regime == "risk-off"), "expected risk-off regime");
    }

    #[test]
    fn test_normal_when_mixed() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), uptrend(200)),
            ("B".to_string(), downtrend(200)),
            ("C".to_string(), uptrend(200)),
            ("D".to_string(), downtrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.9),
            ("B".to_string(), 0.85),
            ("C".to_string(), 0.88),
            ("D".to_string(), 0.92),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        assert!(regimes.iter().any(|r| r.regime == "normal"), "expected normal regime");
    }

    #[test]
    fn test_divergent_detected() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), uptrend(200)),
            ("B".to_string(), uptrend(200)),
            ("C".to_string(), uptrend(200)),
            ("D".to_string(), uptrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.1),  // weakly correlated → divergent
            ("B".to_string(), 0.05), // weakly correlated → divergent
            ("C".to_string(), 0.9),
            ("D".to_string(), 0.85),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        assert!(regimes.iter().any(|r| r.regime == "divergent"), "expected divergent regime");
        let divergent = regimes.iter().find(|r| r.regime == "divergent").unwrap();
        assert!(divergent.affected_symbols.contains(&"A".to_string()));
        assert!(divergent.affected_symbols.contains(&"B".to_string()));
    }

    #[test]
    fn test_regime_order_divergent_first() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), uptrend(200)),
            ("B".to_string(), uptrend(200)),
            ("C".to_string(), uptrend(200)),
            ("D".to_string(), uptrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.1),
            ("B".to_string(), 0.05),
            ("C".to_string(), 0.9),
            ("D".to_string(), 0.85),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        // First entry should be divergent (it can coexist).
        assert_eq!(regimes[0].regime, "divergent");
    }

    #[test]
    fn test_empty_data_returns_normal() {
        let regimes = detect_regimes(&[], &[]);
        assert_eq!(regimes.len(), 1);
        assert_eq!(regimes[0].regime, "normal");
    }

    #[test]
    fn test_mixed_returns_normal_with_divergent() {
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), uptrend(200)),
            ("B".to_string(), downtrend(100)),
            ("C".to_string(), uptrend(200)),
        ];
        let market_corrs = vec![
            ("A".to_string(), 0.1),
            ("B".to_string(), 0.9),
            ("C".to_string(), 0.05),
        ];
        let regimes = detect_regimes(&data, &market_corrs);
        let regimes_found: Vec<&str> = regimes.iter().map(|r| r.regime.as_str()).collect();
        assert!(regimes_found.contains(&"divergent"));
        assert!(regimes_found.contains(&"normal") || regimes_found.contains(&"risk-on"));
    }
}
