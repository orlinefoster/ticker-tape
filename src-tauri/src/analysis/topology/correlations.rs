//! Correlation analysis for market topology.
//!
//! Computes Pearson correlation coefficients between all pairs of
//! assets using rolling daily returns over a 63-trading-day window
//! (≈3 calendar months).

use super::types::CorrelationMatrix;

/// Number of trading days used for the correlation window.
const CORRELATION_WINDOW: usize = 63;

/// Compute the full N×N correlation matrix for the universe.
///
/// # Arguments
///
/// * `price_data` — Slice of `(symbol, closes)` tuples. Each close series
///   must be chronological (oldest first).
///
/// # Returns
///
/// A `CorrelationMatrix` with symmetric N×N correlation values on the
/// diagonal (always 1.0) and off-diagonal Pearson correlations in [-1, 1].
pub fn compute_correlations(price_data: &[(String, Vec<f64>)]) -> CorrelationMatrix {
    let symbols: Vec<String> = price_data.iter().map(|(s, _)| s.clone()).collect();
    let n = symbols.len();

    // Pre-compute daily log returns for each asset.
    let log_returns: Vec<Vec<f64>> = price_data
        .iter()
        .map(|(_, closes)| compute_daily_log_returns(closes))
        .collect();

    let mut correlations = vec![vec![0.0_f64; n]; n];

    for i in 0..n {
        for j in 0..n {
            if i == j {
                correlations[i][j] = 1.0;
            } else {
                correlations[i][j] = pearson_correlation(&log_returns[i], &log_returns[j]);
            }
        }
    }

    CorrelationMatrix {
        symbols,
        correlations,
    }
}

/// Compute daily log returns from close prices.
///
/// Returns `ln(close[t] / close[t-1])` for each adjacent pair.
fn compute_daily_log_returns(closes: &[f64]) -> Vec<f64> {
    if closes.len() < 2 {
        return Vec::new();
    }

    closes
        .windows(2)
        .map(|w| {
            if w[0] != 0.0 {
                (w[1] / w[0]).ln()
            } else {
                0.0
            }
        })
        .collect()
}

/// Compute Pearson correlation coefficient between two return series.
///
/// Uses a rolling window of the last `CORRELATION_WINDOW` overlapping
/// observations. If either series has fewer than 2 observations within
/// the window, returns 0.0.
///
/// r = (n·Σxy − Σx·Σy) / √((n·Σx² − (Σx)²)(n·Σy² − (Σy)²))
fn pearson_correlation(a: &[f64], b: &[f64]) -> f64 {
    let n = CORRELATION_WINDOW.min(a.len()).min(b.len());

    if n < 2 {
        return 0.0;
    }

    let start_a = a.len() - n;
    let start_b = b.len() - n;

    let window_a = &a[start_a..];
    let window_b = &b[start_b..];

    let sum_x: f64 = window_a.iter().sum();
    let sum_y: f64 = window_b.iter().sum();
    let sum_xy: f64 = window_a.iter().zip(window_b.iter()).map(|(x, y)| x * y).sum();
    let sum_x2: f64 = window_a.iter().map(|x| x * x).sum();
    let sum_y2: f64 = window_b.iter().map(|y| y * y).sum();

    let numerator = n as f64 * sum_xy - sum_x * sum_y;
    let denominator = ((n as f64 * sum_x2 - sum_x * sum_x) * (n as f64 * sum_y2 - sum_y * sum_y)).sqrt();

    if denominator < 1e-10 {
        0.0
    } else {
        (numerator / denominator).clamp(-1.0, 1.0)
    }
}

/// Compute each asset's correlation to the equal-weight universe average.
///
/// The "market average" is the mean daily log return across all assets
/// on each overlapping day. Each asset's own correlation to that average
/// is returned.
///
/// # Arguments
///
/// * `price_data` — Slice of `(symbol, closes)` tuples.
///
/// # Returns
///
/// Vector of `(symbol, correlation_to_market)` pairs, one per asset.
pub fn correlation_to_market(price_data: &[(String, Vec<f64>)]) -> Vec<(String, f64)> {
    if price_data.is_empty() {
        return Vec::new();
    }

    let symbols: Vec<String> = price_data.iter().map(|(s, _)| s.clone()).collect();
    let log_returns: Vec<Vec<f64>> = price_data
        .iter()
        .map(|(_, closes)| compute_daily_log_returns(closes))
        .collect();

    // Build equal-weight average return series (only on overlapping days).
    let min_len = log_returns.iter().map(|r| r.len()).min().unwrap_or(0);
    if min_len < 2 {
        return symbols.into_iter().map(|s| (s, 0.0)).collect();
    }

    let market_avg: Vec<f64> = (0..min_len)
        .map(|i| {
            let day_sum: f64 = log_returns.iter().map(|r| r[i]).sum();
            day_sum / log_returns.len() as f64
        })
        .collect();

    symbols
        .into_iter()
        .enumerate()
        .map(|(idx, symbol)| {
            let corr = pearson_correlation(&log_returns[idx], &market_avg);
            (symbol, corr)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Generate price data that moves in sync (perfect correlation).
    fn perfect_correlation_prices() -> Vec<(String, Vec<f64>)> {
        vec![
            ("A".to_string(), (0..200).map(|i| 100.0 + i as f64).collect()),
            ("B".to_string(), (0..200).map(|i| 200.0 + i as f64 * 2.0).collect()),
        ]
    }

    /// Generate inversely correlated price data.
    /// A trends up with noise, B trends down with INVERSE noise.
    /// Their daily log returns should be strongly negatively correlated.
    fn inverse_correlation_prices() -> Vec<(String, Vec<f64>)> {
        let mut a = Vec::with_capacity(200);
        let mut b = Vec::with_capacity(200);
        let mut pa = 100.0;
        let mut pb = 200.0;
        let mut rng = 42.0f64;
        for _ in 0..200 {
            rng = (rng * 1.0001 + 0.001).fract();
            let noise = (rng - 0.5) * 2.0; // -1..1
            pa *= 1.001 + noise * 0.005;   // uptrend + noise
            pb *= 0.999 - noise * 0.005;   // downtrend - noise (inverse)
            a.push(pa);
            b.push(pb);
        }
        vec![("A".to_string(), a), ("B".to_string(), b)]
    }

    #[test]
    fn test_self_correlation_is_one() {
        let data = perfect_correlation_prices();
        let matrix = compute_correlations(&data);
        assert_eq!(matrix.symbols, vec!["A", "B"]);
        assert!((matrix.correlations[0][0] - 1.0).abs() < 0.001);
        assert!((matrix.correlations[1][1] - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_perfectly_correlated() {
        let data = perfect_correlation_prices();
        let matrix = compute_correlations(&data);
        assert!(
            matrix.correlations[0][1] > 0.99,
            "A~B should be > 0.99, got {}",
            matrix.correlations[0][1]
        );
    }

    #[test]
    fn test_inversely_correlated() {
        let data = inverse_correlation_prices();
        let matrix = compute_correlations(&data);
        assert!(
            matrix.correlations[0][1] < -0.99,
            "A~B should be < -0.99, got {}",
            matrix.correlations[0][1]
        );
    }

    #[test]
    fn test_correlation_is_symmetric() {
        let data = vec![
            ("A".to_string(), (0..100).map(|i| 100.0 + (i as f64).sin() * 10.0).collect()),
            ("B".to_string(), (0..100).map(|i| 100.0 + (i as f64).cos() * 10.0).collect()),
            ("C".to_string(), (0..100).map(|i| 100.0 + ((i as f64) * 0.5).sin() * 15.0).collect()),
        ];
        let matrix = compute_correlations(&data);
        for i in 0..3 {
            for j in 0..3 {
                assert!(
                    (matrix.correlations[i][j] - matrix.correlations[j][i]).abs() < 0.001,
                    "matrix should be symmetric at [{}, {}]",
                    i,
                    j
                );
            }
        }
    }

    #[test]
    fn test_correlation_clamped() {
        let data = vec![
            ("A".to_string(), vec![100.0, 101.0]),  // only 2 data points
            ("B".to_string(), vec![200.0, 202.0]),
        ];
        let matrix = compute_correlations(&data);
        // With only 2 samples the window is min(63, 1) = 1 → no window → 0.0
        assert!(
            matrix.correlations[0][1].abs() <= 1.0,
            "correlation must be in [-1, 1]"
        );
    }

    #[test]
    fn test_daily_log_returns_length() {
        let closes = vec![100.0, 102.0, 101.0, 103.0, 105.0];
        let returns = compute_daily_log_returns(&closes);
        assert_eq!(returns.len(), 4);
    }

    #[test]
    fn test_daily_log_returns_positive() {
        let closes = vec![100.0, 110.0];
        let returns = compute_daily_log_returns(&closes);
        assert!(returns[0] > 0.0);
    }

    #[test]
    fn test_correlation_to_market_same_direction() {
        let data = vec![
            ("A".to_string(), (0..200).map(|i| 100.0 + i as f64).collect()),
            ("B".to_string(), (0..200).map(|i| 200.0 + i as f64 * 2.0).collect()),
        ];
        let market_corrs = correlation_to_market(&data);
        assert_eq!(market_corrs.len(), 2);
        for (_, corr) in &market_corrs {
            assert!(*corr > 0.99, "all assets should be highly correlated to market");
        }
    }

    #[test]
    fn test_correlation_to_market_empty() {
        let result = correlation_to_market(&[]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_pearson_zero_denominator() {
        let a = vec![1.0, 1.0, 1.0];
        let b = vec![2.0, 2.0, 2.0];
        let corr = pearson_correlation(&a, &b);
        assert_eq!(corr, 0.0, "constant series should give 0.0");
    }
}
