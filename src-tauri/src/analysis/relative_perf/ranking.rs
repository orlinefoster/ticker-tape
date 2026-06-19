//! Relative strength ranking and benchmarking.
//!
//! Core algorithm:
//! 1. Compute multi-window returns for each asset
//! 2. Rank assets within each window
//! 3. Compute composite RS score weighted toward shorter windows
//! 4. Compare each asset's returns vs benchmark

use super::types::RelativeStrength;

/// Trading-day windows for return computation.
const WINDOWS: &[WindowDef] = &[
    WindowDef { periods: 5,   label: "1w" },
    WindowDef { periods: 21,  label: "1m" },
    WindowDef { periods: 63,  label: "3m" },
    WindowDef { periods: 126, label: "6m" },
    WindowDef { periods: 252, label: "1y" },
];

#[allow(dead_code)]
struct WindowDef {
    periods: usize,
    label: &'static str,
}

/// Weights for composite RS score (favour shorter windows for responsiveness).
const RS_WEIGHTS: &[f64] = &[0.35, 0.30, 0.20, 0.10, 0.05];

/// Compute simple return for a given lookback.
fn window_return(closes: &[f64], periods: usize) -> f64 {
    if closes.len() <= periods {
        return 0.0;
    }
    let current = closes[closes.len() - 1];
    let past = closes[closes.len() - 1 - periods];
    if past == 0.0 {
        0.0
    } else {
        (current - past) / past
    }
}

/// Compute the 5 window returns for a close series.
fn compute_returns(closes: &[f64]) -> [f64; 5] {
    let mut out = [0.0; 5];
    for (i, w) in WINDOWS.iter().enumerate() {
        out[i] = window_return(closes, w.periods);
    }
    out
}

/// Rank assets (1 = best/highest return) within a window and assign percentile (0-100).
fn rank_and_score(values: &[f64]) -> Vec<(usize, f64)> {
    let n = values.len();
    if n == 0 {
        return Vec::new();
    }

    // Sort indices by value descending
    let mut indices: Vec<usize> = (0..n).collect();
    indices.sort_by(|&a, &b| values[b].partial_cmp(&values[a]).unwrap_or(std::cmp::Ordering::Equal));

    // Assign rank + percentile score
    let mut result = vec![(0usize, 0.0f64); n];
    for (pos, &idx) in indices.iter().enumerate() {
        let rank = pos + 1;
        let pct = (1.0 - (pos as f64 / n as f64)) * 100.0; // 100 = best, 0 = worst
        result[idx] = (rank, pct);
    }
    result
}

/// Compute the full relative strength ranking for a universe.
///
/// # Arguments
///
/// * `price_data` — `(symbol, closes)` tuples. Closes oldest-first.
/// * `benchmark` — symbol to use as benchmark (e.g. `"SPY"`).
///
/// # Returns
///
/// A `Vec<RelativeStrength>` sorted by composite_rs descending.
pub fn compute_relative_strength(
    price_data: &[(String, Vec<f64>)],
    benchmark: &str,
) -> Vec<RelativeStrength> {
    if price_data.is_empty() {
        return Vec::new();
    }

    // 1. Compute window returns for each asset
    let asset_returns: Vec<(&str, [f64; 5])> = price_data
        .iter()
        .map(|(s, c)| (s.as_str(), compute_returns(c)))
        .collect();

    // 2. Find benchmark returns (or defaults to zero if not in universe)
    let bench_returns: [f64; 5] = asset_returns
        .iter()
        .find(|(s, _)| *s == benchmark)
        .map(|(_, r)| *r)
        .unwrap_or([0.0; 5]);

    // 3. Rank within each window (exclude benchmark from ranking)
    let non_bench: Vec<(&str, [f64; 5])> = asset_returns
        .iter()
        .filter(|(s, _)| *s != benchmark)
        .copied()
        .collect();

    let n = non_bench.len();
    if n == 0 {
        return Vec::new();
    }

    let window_returns: Vec<Vec<f64>> = (0..5)
        .map(|w| non_bench.iter().map(|(_, r)| r[w]).collect())
        .collect();

    let rankings: Vec<Vec<(usize, f64)>> = window_returns
        .iter()
        .map(|vals| rank_and_score(vals))
        .collect();

    // 4. Build result
    let mut results: Vec<RelativeStrength> = non_bench
        .iter()
        .enumerate()
        .map(|(i, (symbol, returns))| {
            let rnk_1w = rankings[0][i].0;
            let rnk_1m = rankings[1][i].0;
            let rnk_3m = rankings[2][i].0;
            let rnk_6m = rankings[3][i].0;
            let rnk_1y = rankings[4][i].0;

            // Percentile scores (0-100) for composite
            let pct_1w = rankings[0][i].1;
            let pct_1m = rankings[1][i].1;
            let pct_3m = rankings[2][i].1;
            let pct_6m = rankings[3][i].1;
            let pct_1y = rankings[4][i].1;

            let composite_rs = pct_1w * RS_WEIGHTS[0]
                + pct_1m * RS_WEIGHTS[1]
                + pct_3m * RS_WEIGHTS[2]
                + pct_6m * RS_WEIGHTS[3]
                + pct_1y * RS_WEIGHTS[4];

            RelativeStrength {
                symbol: symbol.to_string(),
                returns_1w: returns[0],
                returns_1m: returns[1],
                returns_3m: returns[2],
                returns_6m: returns[3],
                returns_1y: returns[4],
                rank_1w: rnk_1w,
                rank_1m: rnk_1m,
                rank_3m: rnk_3m,
                rank_6m: rnk_6m,
                rank_1y: rnk_1y,
                composite_rs,
                vs_benchmark_1m: returns[1] - bench_returns[1],
                vs_benchmark_3m: returns[2] - bench_returns[2],
                vs_benchmark_6m: returns[3] - bench_returns[3],
            }
        })
        .collect();

    results.sort_by(|a, b| b.composite_rs.partial_cmp(&a.composite_rs).unwrap_or(std::cmp::Ordering::Equal));
    results
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn uptrend() -> Vec<f64> {
        let mut rng = 42.0f64;
        (0..300).scan(100.0, |p, _| {
            rng = (rng * 1.0001 + 0.001).fract();
            *p *= 1.001 + (rng - 0.5) * 0.001;
            Some(*p)
        }).collect()
    }

    fn downtrend() -> Vec<f64> {
        let mut rng = 42.0f64;
        (0..300).scan(100.0, |p, _| {
            rng = (rng * 1.0001 + 0.001).fract();
            *p *= 0.999 + (rng - 0.5) * 0.001;
            Some(*p)
        }).collect()
    }

    #[test]
    fn test_uptrend_beats_downtrend() {
        let data = vec![
            ("SPY".to_string(), uptrend()),
            ("QQQ".to_string(), uptrend()),
            ("TLT".to_string(), downtrend()),
        ];
        let results = compute_relative_strength(&data, "SPY");
        assert_eq!(results.len(), 2); // SPY is benchmark, excluded from ranking
        assert!(results[0].composite_rs > results[1].composite_rs, "up should beat down");
        assert_eq!(results[0].symbol, "QQQ");
        assert_eq!(results[1].symbol, "TLT");
    }

    #[test]
    fn test_benchmark_not_in_universe() {
        let data = vec![
            ("A".to_string(), uptrend()),
            ("B".to_string(), downtrend()),
        ];
        let results = compute_relative_strength(&data, "SPY");
        assert_eq!(results.len(), 2);
        assert!(results[0].composite_rs > results[1].composite_rs);
    }

    #[test]
    fn test_empty_universe() {
        let results = compute_relative_strength(&[], "SPY");
        assert!(results.is_empty());
    }

    #[test]
    fn test_vs_benchmark_positive_for_outperformer() {
        let strong: Vec<f64> = (0..300).map(|i| 100.0 + i as f64 * 0.5).collect();
        let weak: Vec<f64> = (0..300).map(|i| 100.0 + i as f64 * 0.1).collect();
        let data = vec![
            ("SPY".to_string(), strong.clone()),
            ("QQQ".to_string(), weak.clone()),
        ];
        let results = compute_relative_strength(&data, "SPY");
        // SPY is benchmark, only QQQ remains
        assert_eq!(results.len(), 1);
        assert!(results[0].vs_benchmark_1m < 0.0, "QQQ should underperform SPY");
    }

    #[test]
    fn test_rankings_are_meaningful() {
        // 5 assets with clearly different performance
        let data: Vec<(String, Vec<f64>)> = vec![
            ("A".to_string(), (0..300).map(|i| 100.0 + i as f64 * 1.0).collect()), // best
            ("B".to_string(), (0..300).map(|i| 100.0 + i as f64 * 0.8).collect()),
            ("C".to_string(), (0..300).map(|i| 100.0 + i as f64 * 0.6).collect()),
            ("D".to_string(), (0..300).map(|i| 100.0 + i as f64 * 0.4).collect()),
            ("E".to_string(), (0..300).map(|i| 100.0 + i as f64 * 0.2).collect()), // worst
        ];
        let results = compute_relative_strength(&data, "C"); // C is benchmark
        assert_eq!(results.len(), 4);
        assert_eq!(results[0].symbol, "A");
        assert_eq!(results[3].symbol, "E");
    }
}
