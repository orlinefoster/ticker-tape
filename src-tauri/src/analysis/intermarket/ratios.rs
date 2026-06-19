//! Key Ratios Calculation
//!
//! Computes intermarket ratios and trend directions from price data.

use serde::{Deserialize, Serialize};
use anyhow::Result;

/// Trend direction for a ratio
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TrendDirection {
    Rising,
    Falling,
    Sideways,
}

impl std::fmt::Display for TrendDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrendDirection::Rising => write!(f, "subiendo"),
            TrendDirection::Falling => write!(f, "bajando"),
            TrendDirection::Sideways => write!(f, "lateral"),
        }
    }
}

/// Computed intermarket key ratios
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRatios {
    pub stock_bond: f64,
    pub stock_bond_trend: TrendDirection,
    pub cyclical_defensive: f64,
    pub cyclical_defensive_trend: TrendDirection,
    pub commodity_bond: f64,
    pub commodity_bond_trend: TrendDirection,
    pub dollar_ratio: f64,
    pub dollar_trend: TrendDirection,
}

/// Compute all key ratios from price data
pub fn compute_key_ratios(price_data: &[(String, Vec<f64>)]) -> Result<KeyRatios> {
    let get_prices = |symbol: &str| -> Option<&[f64]> {
        price_data.iter().find(|(s, _)| s == symbol).map(|(_, p)| p.as_slice())
    };

    // Stock/Bond ratio
    let stock_bond = ratio_of(get_prices("SPY"), get_prices("TLT"));
    let stock_bond_trend = trend_direction(get_prices("SPY"), get_prices("TLT"));

    // Cyclical/Defensive ratio
    let cyclical = avg_ratios(&[
        get_prices("XLF"),
        get_prices("XLI"),
        get_prices("XLY"),
    ]);
    let defensive = avg_ratios(&[
        get_prices("XLV"),
        get_prices("XLP"),
    ]);
    let cyclical_defensive = match (cyclical, defensive) {
        (Some(c), Some(d)) if d > 0.0 => c / d,
        _ => 1.0,
    };
    let cyclical_defensive_trend = trend_direction_from_ratios(
        get_prices("XLF"),
        get_prices("XLP"),
    );

    // Commodity/Bond ratio
    let commodity_bond = ratio_of(get_prices("DBC"), get_prices("TLT"));
    let commodity_bond_trend = trend_direction(get_prices("DBC"), get_prices("TLT"));

    // Dollar
    let dollar_ratio = get_prices("DXY")
        .and_then(|p| p.last().copied())
        .unwrap_or(100.0);
    let dollar_trend = single_trend(get_prices("DXY"));

    Ok(KeyRatios {
        stock_bond,
        stock_bond_trend,
        cyclical_defensive,
        cyclical_defensive_trend,
        commodity_bond,
        commodity_bond_trend,
        dollar_ratio,
        dollar_trend,
    })
}

/// Compute ratio of two price series (latest values)
fn ratio_of(a: Option<&[f64]>, b: Option<&[f64]>) -> f64 {
    match (a, b) {
        (Some(a), Some(b)) => {
            let last_a = a.last().copied().unwrap_or(1.0);
            let last_b = b.last().copied().unwrap_or(1.0);
            if last_b != 0.0 { last_a / last_b } else { 1.0 }
        }
        _ => 1.0,
    }
}

/// Average ratio of multiple series
fn avg_ratios(series: &[Option<&[f64]>]) -> Option<f64> {
    let values: Vec<f64> = series.iter()
        .filter_map(|s| s.and_then(|p| p.last().copied()))
        .collect();
    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<f64>() / values.len() as f64)
    }
}

/// Trend direction comparing SPY vs TLT (or similar pairs)
fn trend_direction(prices_a: Option<&[f64]>, prices_b: Option<&[f64]>) -> TrendDirection {
    match (prices_a, prices_b) {
        (Some(a), Some(b)) => {
            if a.len() < 50 || b.len() < 50 {
                return TrendDirection::Sideways;
            }
            let ratio: Vec<f64> = a.iter().zip(b.iter())
                .map(|(x, y)| if *y != 0.0 { x / y } else { 0.0 })
                .collect();
            single_trend(Some(&ratio))
        }
        _ => TrendDirection::Sideways,
    }
}

/// Trend direction comparing cyclical vs defensive
fn trend_direction_from_ratios(
    cyclical_prices: Option<&[f64]>,
    defensive_prices: Option<&[f64]>,
) -> TrendDirection {
    match (cyclical_prices, defensive_prices) {
        (Some(c), Some(d)) => {
            if c.len() < 50 || d.len() < 50 {
                return TrendDirection::Sideways;
            }
            let ratio: Vec<f64> = c.iter().zip(d.iter())
                .map(|(x, y)| if *y != 0.0 { x / y } else { 0.0 })
                .collect();
            single_trend(Some(&ratio))
        }
        _ => TrendDirection::Sideways,
    }
}

/// Determine trend from a single price series using SMA crossover
fn single_trend(prices: Option<&[f64]>) -> TrendDirection {
    match prices {
        Some(p) if p.len() >= 50 => {
            let fast_sma = simple_moving_average(p, 20);
            let slow_sma = simple_moving_average(p, 50);
            let threshold = 0.01; // 1% threshold to avoid noise

            let diff = (fast_sma - slow_sma) / slow_sma;
            if diff > threshold {
                TrendDirection::Rising
            } else if diff < -threshold {
                TrendDirection::Falling
            } else {
                TrendDirection::Sideways
            }
        }
        _ => TrendDirection::Sideways,
    }
}

fn simple_moving_average(data: &[f64], period: usize) -> f64 {
    if data.len() < period {
        return data.iter().copied().sum::<f64>() / data.len() as f64;
    }
    let start = data.len() - period;
    let sum: f64 = data[start..].iter().copied().sum();
    sum / period as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rising_prices() -> Vec<f64> {
        (0..100).map(|i| 100.0 + i as f64 * 0.5).collect()
    }

    fn falling_prices() -> Vec<f64> {
        (0..100).map(|i| 200.0 - i as f64 * 0.5).collect()
    }

    #[test]
    fn test_single_trend_rising() {
        assert!(matches!(single_trend(Some(&rising_prices())), TrendDirection::Rising));
    }

    #[test]
    fn test_single_trend_falling() {
        assert!(matches!(single_trend(Some(&falling_prices())), TrendDirection::Falling));
    }

    #[test]
    fn test_single_trend_insufficient_data() {
        let short = vec![100.0];
        assert!(matches!(single_trend(Some(&short)), TrendDirection::Sideways));
    }

    #[test]
    fn test_ratio_of() {
        let a = vec![100.0, 110.0, 120.0];
        let b = vec![100.0, 100.0, 100.0];
        assert!((ratio_of(Some(&a), Some(&b)) - 1.2).abs() < 0.001);
    }

    #[test]
    fn test_ratio_of_zero_divisor() {
        let a = vec![100.0];
        let b = vec![0.0];
        assert!((ratio_of(Some(&a), Some(&b)) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_key_ratios_defaults_on_empty() {
        let data = vec![];
        let result = compute_key_ratios(&data).unwrap();
        assert!((result.stock_bond - 1.0).abs() < 0.001);
        assert!(matches!(result.stock_bond_trend, TrendDirection::Sideways));
    }
}
