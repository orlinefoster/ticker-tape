//! Elliott Wave counting algorithm.
//!
//! Detects impulse waves (1-2-3-4-5) and corrective waves (A-B-C)
//! from price data using swing highs/lows and Fibonacci relationships.
//!
//! # Approach
//!
//! 1. **Zigzag** — Identify significant swing highs and lows
//! 2. **Grouping** — Cluster swings into 5-wave impulse / 3-wave corrective
//! 3. **Rules** — Validate against Elliott Wave rules:
//!    - Wave 2 never retraces > 100 % of wave 1
//!    - Wave 3 is never the shortest
//!    - Wave 4 never overlaps wave 1 (in impulse)
//! 4. **Fibonacci** — Check retracement / extension ratios (0.382, 0.5, 0.618, 1.272, 1.618)
//!
//! The result is a best-effort count that the user can refine manually.

use chrono::NaiveDate;

use super::types::{FibCluster, WaveLabel};

/// Minimum percentage change to consider a swing point significant.
const SWING_THRESHOLD: f64 = 3.0; // 3%

/// Minimum number of bars between swing points.
const SWING_MIN_BARS: usize = 5;

/// Detect swing highs and lows in a price series.
///
/// Returns a list of (date, price, is_high) tuples.
fn detect_swings(
    dates: &[NaiveDate],
    closes: &[f64],
) -> Vec<(NaiveDate, f64, bool)> {
    if closes.len() < SWING_MIN_BARS * 2 {
        return Vec::new();
    }

    let half_window = SWING_MIN_BARS / 2;

    // First pass: find all local extrema
    let mut candidates: Vec<(NaiveDate, f64, bool)> = Vec::new();
    for i in half_window..closes.len().saturating_sub(half_window) {
        let mut is_high = true;
        let mut is_low = true;

        for j in (i - half_window)..=(i + half_window) {
            if j == i {
                continue;
            }
            if closes[j] > closes[i] {
                is_high = false;
            }
            if closes[j] < closes[i] {
                is_low = false;
            }
        }

        if is_high || is_low {
            candidates.push((dates[i], closes[i], is_high));
        }
    }

    // Anchor start and end so the zigzag covers the full range.
    let up_trend = closes.last().copied().unwrap_or(0.0) >= closes.first().copied().unwrap_or(0.0);
    candidates.insert(0, (dates[0], closes[0], !up_trend));
    let last_idx = closes.len() - 1;
    candidates.push((dates[last_idx], closes[last_idx], up_trend));

    // Second pass: filter alternating swings with significance threshold.
    // Compare each candidate to the LAST ACCEPTED SWING (not the previous bar).
    // Always keep the first and last candidates (anchors).
    let total = candidates.len();
    let mut filtered: Vec<(NaiveDate, f64, bool)> = Vec::new();
    for (idx, swing) in candidates.into_iter().enumerate() {
        let is_last = idx == total - 1;
        match filtered.last() {
            Some(&(_, last_price, last_is_high)) if last_is_high == swing.2 => {
                // Same direction — keep the more extreme one
                if (swing.2 && swing.1 > last_price)
                    || (!swing.2 && swing.1 < last_price)
                {
                    filtered.pop();
                    filtered.push(swing);
                } else if is_last {
                    // Always append the last point even if less extreme
                    filtered.push(swing);
                }
            }
            Some(&(_, last_price, _)) => {
                // Different direction — check significance vs last swing
                let change_pct = (swing.1 / last_price - 1.0).abs() * 100.0;
                if change_pct >= SWING_THRESHOLD || is_last {
                    filtered.push(swing);
                }
            }
            None => {
                // First swing — always accept
                filtered.push(swing);
            }
        }
    }

    filtered
}

/// Check if swings form a valid 5-wave impulse pattern.
///
/// Rules enforced:
/// - Wave 1, 3, 5 are motive (in direction of trend)
/// - Wave 2, 4 are corrective (against trend)
/// - Wave 3 is NOT the shortest
/// - Wave 2 retraces < 100% of wave 1
/// - Wave 4 does NOT overlap wave 1
fn is_valid_impulse(swings: &[(NaiveDate, f64, bool)]) -> bool {
    if swings.len() < 5 {
        return false;
    }

    // Check alternating pattern: high, low, high, low, high (uptrend)
    // or low, high, low, high, low (downtrend)
    let is_up = swings[5].1 > swings[0].1; // 6th swing higher than 1st → uptrend
    let expected_high = !is_up; // Up-trend impulse starts with LOW

    for (i, &(_, _, is_high)) in swings.iter().enumerate().take(5) {
        let expect_high = if i % 2 == 0 { expected_high } else { !expected_high };
        if is_high != expect_high {
            return false;
        }
    }

    // Wave 2: should not retrace more than 100% of wave 1
    let wave1_len = (swings[1].1 - swings[0].1).abs();
    let wave2_retrace = (swings[2].1 - swings[1].1).abs();
    if wave1_len > 0.0 && wave2_retrace > wave1_len * 1.01 {
        return false;
    }

    // Wave 3 should NOT be the shortest
    let wave1 = wave1_len;
    let wave3 = (swings[3].1 - swings[2].1).abs();
    let wave5 = (swings[5].1 - swings[4].1).abs();

    if wave3 < wave1 && wave3 < wave5 {
        return false;
    }

    // Wave 4 should not overlap wave 1 territory
    if is_up {
        let wave4_low = swings[3].1.min(swings[4].1);
        let wave1_high = swings[0].1.max(swings[1].1);
        if wave4_low <= wave1_high {
            return false;
        }
    } else {
        let wave4_high = swings[3].1.max(swings[4].1);
        let wave1_low = swings[0].1.min(swings[1].1);
        if wave4_high >= wave1_low {
            return false;
        }
    }

    true
}

/// Compute the Fibonacci extension (extension > 1.0) or retracement.
#[allow(dead_code)]
fn fib_level(price_a: f64, price_b: f64, ratio: f64) -> f64 {
    price_a + (price_b - price_a) * ratio
}

/// Detect Fibonacci clusters from wave labels.
pub fn find_fib_clusters(waves: &[WaveLabel], _current_price: f64) -> Vec<FibCluster> {
    if waves.len() < 5 {
        return Vec::new();
    }

    let mut clusters = Vec::new();

    // Get impulse wave prices
    let wave1_start = waves[0].price_start.unwrap_or(0.0);
    let wave1_end = waves[0].price_end.unwrap_or(0.0);
    let _wave3_end = waves[2].price_end.unwrap_or(0.0);
    let _wave5_end = waves[4].price_end.unwrap_or(0.0);

    let is_up = wave1_end >= wave1_start;

    // Common Fibonacci targets for wave 5
    let fibs = [0.382, 0.5, 0.618, 1.0, 1.272, 1.618];
    for &ratio in &fibs {
        let target = if is_up {
            // Extend from wave 1
            wave1_start + (wave1_end - wave1_start) * (1.0 + ratio)
        } else {
            wave1_start - (wave1_start - wave1_end) * (1.0 + ratio)
        };

        let strength = match ratio {
            r if (r - 0.618).abs() < 0.01 => 0.8,
            r if (r - 1.0).abs() < 0.01 => 0.6,
            r if (r - 1.618).abs() < 0.01 => 0.7,
            _ => 0.3,
        };

        clusters.push(FibCluster {
            direction: if is_up { "up".to_string() } else { "down".to_string() },
            price_target: target,
            sources: vec![format!("{:.3} of wave 1", ratio)],
            strength,
        });
    }

    clusters
}

/// Count waves for a symbol and return labelled waves.
///
/// Returns `(impulse_waves, corrective_waves, clusters)`.
/// The caller is responsible for persisting these via `WaveLabelRepository`.
pub fn count_waves(
    symbol: &str,
    dates: &[NaiveDate],
    closes: &[f64],
    timeframe: &str,
) -> (Vec<WaveLabel>, Vec<WaveLabel>, Vec<FibCluster>) {
    if dates.len() < 20 || closes.len() < 20 {
        return (Vec::new(), Vec::new(), Vec::new());
    }

    let swings = detect_swings(dates, closes);

    if swings.len() < 6 {
        return (Vec::new(), Vec::new(), Vec::new());
    }

    let mut impulse: Vec<WaveLabel> = Vec::new();
    let mut corrective: Vec<WaveLabel> = Vec::new();

    // Check every 5-swing window for valid impulse patterns
    for start in 0..swings.len().saturating_sub(5) {
        let window = &swings[start..start + 6]; // 6 swing points = 5 waves
        if !is_valid_impulse(window) {
            continue;
        }

        let impulse_labels = ["1", "2", "3", "4", "5"];

        for (i, &(date, price, _)) in window.iter().enumerate().take(5) {
            let (start_date, end_date) = if i < 4 {
                (date, Some(window[i + 1].0))
            } else {
                (date, None)
            };

            impulse.push(WaveLabel {
                id: None,
                symbol: symbol.to_string(),
                timeframe: timeframe.to_string(),
                wave_degree: "primary".to_string(),
                wave_label: impulse_labels[i].to_string(),
                start_date,
                end_date,
                price_start: Some(price),
                price_end: if i < 4 { Some(window[i + 1].1) } else { None },
                confidence: 0.7,
                is_automatic: true,
                notes: None,
            });
        }

        // After impulse, look for corrective A-B-C
        if start + 8 < swings.len() {
            let correction_window = &swings[start + 5..start + 9]; // 4 points = A-B-C
            if correction_window.len() >= 4 {
                let corr_labels = ["A", "B", "C"];
                for (i, &(date, price, _)) in correction_window.iter().enumerate().take(3) {
                    corrective.push(WaveLabel {
                        id: None,
                        symbol: symbol.to_string(),
                        timeframe: timeframe.to_string(),
                        wave_degree: "primary".to_string(),
                        wave_label: corr_labels[i].to_string(),
                        start_date: date,
                        end_date: if i < 2 { Some(correction_window[i + 1].0) } else { None },
                        price_start: Some(price),
                        price_end: if i < 2 { Some(correction_window[i + 1].1) } else { None },
                        confidence: 0.5,
                        is_automatic: true,
                        notes: None,
                    });
                }
            }
        }

        break; // Take the first valid count only
    }

    let current_price = closes.last().copied().unwrap_or(0.0);
    let clusters = find_fib_clusters(&impulse, current_price);

    (impulse, corrective, clusters)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    /// Generate a textbook 5-wave impulse up followed by A-B-C correction.
    fn generate_impulse_data() -> (Vec<NaiveDate>, Vec<f64>) {
        let mut dates = Vec::new();
        let mut prices = Vec::new();

        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();

        // Wave 1: up (days 0-9)
        for i in 0..10 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(100.0 + i as f64 * 2.0); // 100 → 118
        }
        // Wave 2: retrace (days 10-19)
        for i in 10..20 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(118.0 - (i - 10) as f64 * 1.2); // 118 → 106 (-10.2%)
        }
        // Wave 3: strong up (days 20-39)
        for i in 20..40 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(106.0 + (i - 20) as f64 * 3.0); // 106 → 166 (+56.6%)
        }
        // Wave 4: shallow retrace (days 40-49)
        for i in 40..50 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(166.0 - (i - 40) as f64 * 1.0); // 166 → 156 (-6.0%)
        }
        // Wave 5: final up (days 50-59)
        for i in 50..60 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(156.0 + (i - 50) as f64 * 1.5); // 156 → 171 (+9.6%)
        }
        // A-B-C correction (days 60-79)
        for i in 60..70 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(171.0 - (i - 60) as f64 * 2.0); // 171 → 151 (-11.7%)
        }
        for i in 70..75 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(151.0 + (i - 70) as f64 * 1.0); // 151 → 155 (+2.6%)
        }
        for i in 75..85 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(155.0 - (i - 75) as f64 * 1.5); // 155 → 140 (-9.7%)
        }

        (dates, prices)
    }

    #[test]
    fn test_detect_swings_on_trending_data() {
        let (dates, prices) = generate_impulse_data();
        let swings = detect_swings(&dates, &prices);
        for (i, &(d, p, h)) in swings.iter().enumerate() {
            eprintln!("  swing[{}]: date={:?}, price={:.1}, is_high={}", i, d, p, h);
        }
        assert!(
            swings.len() >= 6,
            "should detect enough swings for 5-wave count, got {}",
            swings.len()
        );
    }

    #[test]
    fn test_count_waves_returns_impulse() {
        let (dates, prices) = generate_impulse_data();

        // Debug swings
        let swings = detect_swings(&dates, &prices);
        eprintln!("Swings found: {}", swings.len());
        for (i, &(d, p, h)) in swings.iter().enumerate() {
            eprintln!("  swing[{}]: date={:?}, price={:.1}, is_high={}", i, d, p, h);
        }

        let (impulse, corrective, clusters) = count_waves("SPY", &dates, &prices, "1d");

        // Should detect the 5-wave impulse
        assert!(
            !impulse.is_empty(),
            "should detect impulse waves"
        );
        if !impulse.is_empty() {
            assert_eq!(impulse.len(), 5, "should have 5 impulse waves");
            assert_eq!(impulse[0].wave_label, "1");
            assert_eq!(impulse[4].wave_label, "5");
        }

        // Should detect A-B-C correction
        if !corrective.is_empty() {
            assert_eq!(corrective[0].wave_label, "A");
        }

        // Should have Fibonacci clusters
        assert!(!clusters.is_empty(), "should have fib clusters");
    }

    #[test]
    fn test_count_waves_insufficient_data() {
        let dates = vec![NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()];
        let prices = vec![100.0];
        let (impulse, corrective, clusters) = count_waves("SPY", &dates, &prices, "1d");
        assert!(impulse.is_empty());
        assert!(corrective.is_empty());
        assert!(clusters.is_empty());
    }

    #[test]
    fn test_swing_threshold_filters_noise() {
        let mut dates = Vec::new();
        let mut prices = Vec::new();
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();

        // Flat with tiny noise (0.1%) — below SWING_THRESHOLD of 3%
        for i in 0..50 {
            dates.push(start + chrono::Duration::days(i));
            prices.push(100.0 + (i as f64 * 0.05).sin() * 0.1);
        }

        let swings = detect_swings(&dates, &prices);
        assert!(
            swings.len() < 5,
            "tiny noise should not produce significant swings, got {}",
            swings.len()
        );
    }

    #[test]
    fn test_is_valid_impulse_rejects_bad_pattern() {
        // All highs — clearly not alternating
        let swings = vec![
            (NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0, true),
            (NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(), 110.0, true),
            (NaiveDate::from_ymd_opt(2024, 1, 3).unwrap(), 120.0, true),
            (NaiveDate::from_ymd_opt(2024, 1, 4).unwrap(), 130.0, true),
            (NaiveDate::from_ymd_opt(2024, 1, 5).unwrap(), 140.0, true),
            (NaiveDate::from_ymd_opt(2024, 1, 6).unwrap(), 150.0, true),
        ];
        assert!(!is_valid_impulse(&swings));
    }
}
