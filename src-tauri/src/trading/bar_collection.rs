//! BarCollection — a validated, sorted collection of OHLCV bars.
//!
//! Provides safe construction (auto-sort, duplicate rejection) and
//! common financial math helpers (returns, moving averages).

use std::ops::Deref;

use chrono::NaiveDate;

use crate::trading::models::OHLCVBar;

/// Errors that can occur when constructing a `BarCollection`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    /// At least one bar is required.
    Empty,
    /// Bars were not sorted by date (only returned when auto-sort is off).
    Unsorted,
    /// Two or more bars share the same date for the same symbol.
    Duplicate,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Empty => write!(f, "bar collection cannot be empty"),
            Self::Unsorted => write!(f, "bars are not sorted by date"),
            Self::Duplicate => write!(f, "duplicate bar dates found"),
        }
    }
}

impl std::error::Error for ValidationError {}

/// Method used to compute period-over-period returns.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReturnMethod {
    /// (P_t - P_{t-1}) / P_{t-1}
    Simple,
    /// ln(P_t / P_{t-1})
    Log,
}

/// A validated, chronologically-sorted collection of [`OHLCVBar`]s.
///
/// Guarantees:
/// - Bars are sorted by date (ascending).
/// - No two bars share the same date.
/// - Non-empty.
#[derive(Debug, Clone, PartialEq)]
pub struct BarCollection(Vec<OHLCVBar>);

impl BarCollection {
    /// Construct a new `BarCollection`.
    ///
    /// Automatically sorts bars by date and rejects duplicates.
    pub fn new(mut bars: Vec<OHLCVBar>) -> Result<Self, ValidationError> {
        if bars.is_empty() {
            return Err(ValidationError::Empty);
        }

        // Sort by date ascending.
        bars.sort_by_key(|b| b.date);

        // Reject duplicates (same date after sorting).
        for i in 1..bars.len() {
            if bars[i].date == bars[i - 1].date {
                return Err(ValidationError::Duplicate);
            }
        }

        Ok(Self(bars))
    }

    /// Number of bars in the collection.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Returns `true` if the collection is empty.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Earliest and latest date in the collection.
    pub fn range(&self) -> (NaiveDate, NaiveDate) {
        (self.0.first().unwrap().date, self.0.last().unwrap().date)
    }

    /// Period-over-period returns.
    ///
    /// The result has `len() - 1` elements (one fewer than the bar count).
    pub fn returns(&self, method: ReturnMethod) -> Vec<f64> {
        self.0
            .windows(2)
            .map(|w| match method {
                ReturnMethod::Simple => (w[1].close - w[0].close) / w[0].close,
                ReturnMethod::Log => (w[1].close / w[0].close).ln(),
            })
            .collect()
    }

    /// Simple moving average of `close` over the given `period`.
    ///
    /// Returns `None` for the first `period - 1` positions where there
    /// aren't enough data points.
    pub fn apply_sma(&self, period: usize) -> Vec<Option<f64>> {
        if period == 0 || period > self.0.len() {
            return vec![None; self.0.len()];
        }

        let closes: Vec<f64> = self.0.iter().map(|b| b.close).collect();
        let mut result = Vec::with_capacity(self.0.len());

        for i in 0..self.0.len() {
            if i + 1 < period {
                result.push(None);
            } else {
                let sum: f64 = closes[i + 1 - period..=i].iter().sum();
                result.push(Some(sum / period as f64));
            }
        }

        result
    }
}

/// Allow functions taking `&[OHLCVBar]` to accept `&BarCollection` directly.
impl Deref for BarCollection {
    type Target = [OHLCVBar];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    fn make_bar(date: NaiveDate, close: f64) -> OHLCVBar {
        OHLCVBar {
            symbol: "TEST".into(),
            date,
            open: close,
            high: close,
            low: close,
            close,
            volume: 1000.0,
        }
    }

    #[test]
    fn test_new_sorts_and_accepts() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 3).unwrap(), 105.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(), 102.0),
        ];
        let bc = BarCollection::new(bars).unwrap();
        assert_eq!(bc.len(), 3);
        assert_eq!(bc.range().0, NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());
        assert_eq!(bc.range().1, NaiveDate::from_ymd_opt(2024, 1, 3).unwrap());
    }

    #[test]
    fn test_new_rejects_empty() {
        let result = BarCollection::new(vec![]);
        assert_eq!(result, Err(ValidationError::Empty));
    }

    #[test]
    fn test_new_rejects_duplicates() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 101.0),
        ];
        let result = BarCollection::new(bars);
        assert_eq!(result, Err(ValidationError::Duplicate));
    }

    #[test]
    fn test_returns_simple() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(), 110.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 3).unwrap(), 99.0),
        ];
        let bc = BarCollection::new(bars).unwrap();
        let ret = bc.returns(ReturnMethod::Simple);
        assert_eq!(ret.len(), 2);
        assert!((ret[0] - 0.10).abs() < 1e-10);
        assert!((ret[1] + 0.10).abs() < 1e-10);
    }

    #[test]
    fn test_returns_log() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(), 110.0),
        ];
        let bc = BarCollection::new(bars).unwrap();
        let ret = bc.returns(ReturnMethod::Log);
        assert_eq!(ret.len(), 1);
        assert!((ret[0] - (110.0_f64 / 100.0_f64).ln()).abs() < 1e-10);
    }

    #[test]
    fn test_apply_sma() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(), 110.0),
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 3).unwrap(), 120.0),
        ];
        let bc = BarCollection::new(bars).unwrap();
        let sma = bc.apply_sma(2);
        assert_eq!(sma.len(), 3);
        assert!(sma[0].is_none());
        assert!((sma[1].unwrap() - 105.0).abs() < 1e-10);
        assert!((sma[2].unwrap() - 115.0).abs() < 1e-10);
    }

    #[test]
    fn test_apply_sma_larger_than_len() {
        let bars = vec![
            make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0),
        ];
        let bc = BarCollection::new(bars).unwrap();
        let sma = bc.apply_sma(5);
        assert_eq!(sma.len(), 1);
        assert!(sma[0].is_none());
    }

    #[test]
    fn test_deref() {
        let bars = vec![make_bar(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), 100.0)];
        let bc = BarCollection::new(bars).unwrap();
        let slice: &[OHLCVBar] = &*bc;
        assert_eq!(slice.len(), 1);
    }

    #[test]
    fn test_range_single_bar() {
        let bars = vec![make_bar(NaiveDate::from_ymd_opt(2024, 6, 19).unwrap(), 42.0)];
        let bc = BarCollection::new(bars).unwrap();
        let (lo, hi) = bc.range();
        assert_eq!(lo, hi);
    }
}
