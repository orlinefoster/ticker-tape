//! Market data fetching and processing
//!
//! Handles retrieval of OHLCV data from external APIs,
//! local database caching, and data preprocessing.
//!
//! # Flow
//!
//! 1. Caller requests data for a symbol + date range
//! 2. We check the local SQLite cache first
//! 3. On cache miss → delegate to [`DataProvider`]
//! 4. Store fetched bars in cache
//! 5. Return bars to caller

use anyhow::Result;
use chrono::NaiveDate;

use crate::trading::data_provider::provider_for_symbol;
use crate::trading::models::OHLCVBar;

/// Fetch historical OHLCV data for a given symbol and date range.
///
/// Delegates to the best available [`DataProvider`] for the symbol.
/// The caller is responsible for caching (see `fetch_market_data` command).
pub async fn fetch_historical_data(
    symbol: &str,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Vec<OHLCVBar>> {
    let provider = provider_for_symbol(symbol);
    let bars = provider.fetch_bars(symbol, from, to).await?;

    tracing::debug!(
        "Fetched {} bars for {} from {} ({} to {})",
        bars.len(),
        symbol,
        provider.name(),
        from,
        to
    );

    Ok(bars)
}

/// Preprocess raw bars: adjust for splits, dividends, fill gaps.
///
/// Currently a pass-through. Future enhancements:
/// - Forward-fill missing trading days
/// - Adjust for stock splits using Yahoo Finance's `adjclose`
/// - Filter out illiquid / low-volume days
pub fn preprocess_bars(bars: Vec<OHLCVBar>) -> Vec<OHLCVBar> {
    // TODO: Implement data cleaning
    bars
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_historical_data_rejects_invalid_symbol() {
        // An obviously invalid symbol should fail gracefully, not panic.
        let result = fetch_historical_data(
            "!!!INVALID!!!",
            NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            NaiveDate::from_ymd_opt(2024, 1, 5).unwrap(),
        )
        .await;

        assert!(result.is_err(), "invalid symbol should return an error");
        let err = result.unwrap_err().to_string();
        // Should mention Yahoo or HTTP error, not panic
        assert!(
            err.contains("Yahoo") || err.contains("request") || err.contains("parse"),
            "error should describe what failed: {}",
            err
        );
    }

    #[test]
    fn test_preprocess_bars_is_identity() {
        let bars = vec![OHLCVBar {
            symbol: "TEST".to_string(),
            date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            open: 100.0,
            high: 101.0,
            low: 99.0,
            close: 100.5,
            volume: 10000.0,
        }];
        let result = preprocess_bars(bars.clone());
        assert_eq!(result, bars);
    }
}
