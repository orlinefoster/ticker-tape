//! Ranking computation for market topology.
//!
//! Computes multi-window returns, percentile ranks within the
//! universe, volatility, and a combined momentum score for each asset.

use super::types::AssetRanking;

/// Trading-day window sizes used for return computation.
///
/// Approximate calendar equivalents:
/// - 5  days → 1 week
/// - 21 days → 1 month
/// - 63 days → 3 months
/// - 126 days → 6 months
/// - 252 days → 1 year
const WINDOWS: &[WindowDef] = &[
    WindowDef { periods: 5,  label: "1w" },
    WindowDef { periods: 21, label: "1m" },
    WindowDef { periods: 63, label: "3m" },
    WindowDef { periods: 126, label: "6m" },
    WindowDef { periods: 252, label: "1y" },
];

#[allow(dead_code)]
struct WindowDef {
    periods: usize,
    label: &'static str,
}

/// Weights for the combined momentum score.
///
/// Shorter windows receive higher weight to favour recent price action.
const MOMENTUM_WEIGHTS: &[f64] = &[0.35, 0.30, 0.20, 0.10, 0.05];

/// Compute the full ranking of all assets in the universe.
///
/// # Arguments
///
/// * `price_data` — Slice of `(symbol, closes)` tuples. Each series must
///   be a chronological daily close array (oldest first).
///
/// # Returns
///
/// A `Vec<AssetRanking>` sorted by `momentum_score` descending.
pub fn compute_rankings(price_data: &[(String, Vec<f64>)]) -> Vec<AssetRanking> {
    let mut rankings: Vec<AssetRanking> = price_data
        .iter()
        .map(|(symbol, closes)| compute_asset_ranking(symbol, closes))
        .collect();

    // Compute percentile ranks based on combined momentum score.
    assign_percentile_ranks(&mut rankings);

    // Sort by momentum_score descending (best performer first).
    rankings.sort_by(|a, b| b.momentum_score.partial_cmp(&a.momentum_score).unwrap_or(std::cmp::Ordering::Equal));

    rankings
}

/// Compute ranking metrics for a single asset.
fn compute_asset_ranking(symbol: &str, closes: &[f64]) -> AssetRanking {
    let returns = compute_window_returns(closes);

    let volatility = compute_volatility(closes);
    let momentum_score = compute_momentum_score(&returns);

    AssetRanking {
        symbol: symbol.to_string(),
        returns_1w: returns[0],
        returns_1m: returns[1],
        returns_3m: returns[2],
        returns_6m: returns[3],
        returns_1y: returns[4],
        percentile_rank: 0.0, // filled later
        volatility,
        momentum_score,
    }
}

/// Compute return for each window size for a close price series.
///
/// Returns a 5-element array `[1w, 1m, 3m, 6m, 1y]`.
/// If there is insufficient data for a given window, returns 0.0.
fn compute_window_returns(closes: &[f64]) -> [f64; 5] {
    let mut out = [0.0; 5];

    for (i, window) in WINDOWS.iter().enumerate() {
        if closes.len() > window.periods {
            let current = closes[closes.len() - 1];
            let past = closes[closes.len() - 1 - window.periods];
            out[i] = if past != 0.0 {
                (current - past) / past
            } else {
                0.0
            };
        }
    }

    out
}

/// Compute annualized volatility from daily close prices.
///
/// Uses the standard deviation of log returns, annualized by
/// multiplying by √252 (trading days per year).
fn compute_volatility(closes: &[f64]) -> f64 {
    if closes.len() < 2 {
        return 0.0;
    }

    let log_returns: Vec<f64> = closes
        .windows(2)
        .map(|w| (w[1] / w[0]).ln())
        .collect();

    let mean = log_returns.iter().sum::<f64>() / log_returns.len() as f64;
    let variance = log_returns
        .iter()
        .map(|r| (r - mean).powi(2))
        .sum::<f64>()
        / (log_returns.len() - 1) as f64;

    (variance * 252.0).sqrt()
}

/// Compute a weighted momentum score from multi-window returns.
///
/// Weights favour shorter windows to capture recent momentum,
/// while longer windows provide trend context.
fn compute_momentum_score(returns: &[f64; 5]) -> f64 {
    returns
        .iter()
        .zip(MOMENTUM_WEIGHTS)
        .map(|(r, w)| r * w)
        .sum()
}

/// Assign percentile rank (0–100) to each asset based on momentum_score.
fn assign_percentile_ranks(rankings: &mut Vec<AssetRanking>) {
    let n = rankings.len() as f64;
    if n == 0.0 {
        return;
    }

    // Sort by momentum_score ascending for rank assignment.
    rankings.sort_by(|a, b| a.momentum_score.partial_cmp(&b.momentum_score).unwrap_or(std::cmp::Ordering::Equal));

    for (i, ranking) in rankings.iter_mut().enumerate() {
        // Percentile = (position + 1) / total * 100  → 0–100
        ranking.percentile_rank = ((i as f64 + 1.0) / n) * 100.0;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Generate a steady uptrend with noise: 300 days of +0.1% per day + random noise.
    fn uptrend() -> Vec<f64> {
        let mut rng = 42.0f64;
        (0..300).scan(100.0, |price, _| {
            rng = (rng * 1.0001 + 0.001).fract();
            *price *= 1.001 + (rng - 0.5) * 0.001;
            Some(*price)
        }).collect()
    }

    /// Generate a steady downtrend with noise: 300 days of −0.1% per day + random noise.
    fn downtrend() -> Vec<f64> {
        let mut rng = 42.0f64;
        (0..300).scan(100.0, |price, _| {
            rng = (rng * 1.0001 + 0.001).fract();
            *price *= 0.999 + (rng - 0.5) * 0.001;
            Some(*price)
        }).collect()
    }

    /// Generate flat (slightly noisy) prices — very low volatility.
    fn flat() -> Vec<f64> {
        let mut rng = 42.0f64;
        (0..300).scan(100.0, |price, _| {
            rng = (rng * 1.0001 + 0.001).fract();
            *price *= 1.0 + (rng - 0.5) * 0.0005;  // very tiny noise
            Some(*price)
        }).collect()
    }

    #[test]
    fn test_uptrend_has_positive_returns() {
        let prices = uptrend();
        let ranking = compute_asset_ranking("TEST", &prices);
        assert!(ranking.returns_1w > 0.0, "1w return should be positive");
        assert!(ranking.returns_1m > 0.0, "1m return should be positive");
        assert!(ranking.returns_1y > 0.0, "1y return should be positive");
        assert!(ranking.momentum_score > 0.0, "momentum should be positive");
    }

    #[test]
    fn test_downtrend_has_negative_returns() {
        let prices = downtrend();
        let ranking = compute_asset_ranking("TEST", &prices);
        assert!(ranking.returns_1w < 0.0, "1w return should be negative");
        assert!(ranking.returns_1m < 0.0, "1m return should be negative");
        assert!(ranking.momentum_score < 0.0, "momentum should be negative");
    }

    #[test]
    fn test_volatility_is_positive() {
        let prices = uptrend();
        let ranking = compute_asset_ranking("TEST", &prices);
        assert!(ranking.volatility > 0.0, "volatility should be positive");
    }

    #[test]
    fn test_volatility_low_for_flat() {
        let flat_prices = flat();
        let uptrend_prices = uptrend();
        let flat_ranking = compute_asset_ranking("FLAT", &flat_prices);
        let up_ranking = compute_asset_ranking("UP", &uptrend_prices);
        assert!(
            flat_ranking.volatility < up_ranking.volatility,
            "flat series should have lower volatility than trending"
        );
    }

    #[test]
    fn test_percentile_ranks_range() {
        let data = vec![
            ("A".to_string(), uptrend()),
            ("B".to_string(), downtrend()),
            ("C".to_string(), flat()),
        ];
        let rankings = compute_rankings(&data);
        for r in &rankings {
            assert!(
                (0.0..=100.0).contains(&r.percentile_rank),
                "percentile rank should be 0–100, got {}",
                r.percentile_rank
            );
        }
    }

    #[test]
    fn test_rankings_sorted_descending() {
        let data = vec![
            ("A".to_string(), uptrend()),
            ("B".to_string(), downtrend()),
            ("C".to_string(), flat()),
        ];
        let rankings = compute_rankings(&data);
        for i in 1..rankings.len() {
            assert!(
                rankings[i - 1].momentum_score >= rankings[i].momentum_score,
                "rankings should be sorted descending"
            );
        }
    }

    #[test]
    fn test_best_performer_top_percentile() {
        // Use DIFFERENT trends per asset to avoid momentum_score ties.
        let up_strong = uptrend();                       // +0.1%/d
        let up_weak: Vec<f64> = (0..300).scan(100.0, |p, _| { *p *= 1.0005; Some(*p) }).collect(); // milder +0.05%/d
        let down_strong = downtrend();                   // -0.1%/d
        let down_weak: Vec<f64> = (0..300).scan(100.0, |p, _| { *p *= 0.9995; Some(*p) }).collect(); // milder -0.05%/d
        let data = vec![
            ("A".to_string(), up_weak),
            ("B".to_string(), down_strong),
            ("C".to_string(), flat()),
            ("D".to_string(), up_strong),
            ("E".to_string(), down_weak),
        ];
        let rankings = compute_rankings(&data);
        // The best (highest momentum_score) should have percentile_rank = 100.0
        assert!(
            (rankings[0].percentile_rank - 100.0).abs() < 0.01,
            "best rank should have percentile ~100, got {} for {}",
            rankings[0].percentile_rank, rankings[0].symbol
        );
        // The worst should have percentile_rank near ~20 (1/5*100)
        assert!(
            (rankings[rankings.len() - 1].percentile_rank - 20.0).abs() < 0.01,
            "worst rank should have percentile ~20, got {} for {}",
            rankings[rankings.len() - 1].percentile_rank, rankings[rankings.len() - 1].symbol
        );
    }

    #[test]
    fn test_insufficient_data_returns_zero() {
        let short = vec![100.0];
        let ranking = compute_asset_ranking("SHORT", &short);
        assert_eq!(ranking.returns_1w, 0.0);
        assert_eq!(ranking.volatility, 0.0);
        assert_eq!(ranking.momentum_score, 0.0);
    }

    #[test]
    fn test_momentum_weight_prefers_short_term() {
        // Create 300 days of uptrend, then flatten last 20 days.
        // 320 days ensures all windows (incl 1y=252d) have data.
        let mut prices: Vec<f64> = (0..300).map(|i| 100.0 + i as f64 * 0.5).collect();
        let last = prices[prices.len() - 21]; // price at day 279
        for i in (prices.len() - 20)..prices.len() {
            prices[i] = last;
        }
        let ranking = compute_asset_ranking("STALL", &prices);
        // Short windows (1w, 1m) are flat (return ~0), medium windows (3m, 6m) still positive
        // Momentum score should be positive but less than 6m return
        assert!(ranking.momentum_score > 0.0, "momentum should be positive");
        assert!(
            ranking.momentum_score < ranking.returns_6m,
            "momentum ({}) should be < 6m return ({}) when short term stalls",
            ranking.momentum_score,
            ranking.returns_6m
        );
    }

    #[test]
    fn test_empty_universe() {
        let rankings = compute_rankings(&[]);
        assert!(rankings.is_empty());
    }
}
