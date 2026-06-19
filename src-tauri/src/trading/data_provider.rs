//! Data providers for market data fetching.
//!
//! Defines the [`DataProvider`] trait and ready-made implementations:
//! - [`YahooFinanceProvider`] — fetches historical OHLCV from Yahoo Finance v8 API
//! - Binance provider (future)
//!
//! # Architecture
//!
//! Each provider implements the trait and handles:
//! - HTTP request construction
//! - Response parsing into [`OHLCVBar`]s
//! - Symbol conversion / normalisation (provider → internal)
//!
//! The calling code (in `market_data.rs`) handles caching.

use async_trait::async_trait;
use chrono::NaiveDate;
use reqwest::Client;
use serde::Deserialize;

use crate::trading::models::OHLCVBar;

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// A market data provider that can fetch historical OHLCV bars.
///
/// Providers are stateless and should be cheap to create (one per request).
#[async_trait]
pub trait DataProvider: Send + Sync {
    /// Human-readable name (e.g. `"yahoo-finance"`, `"binance"`).
    fn name(&self) -> &str;

    /// Fetch daily OHLCV bars for a symbol over a date range.
    ///
    /// `from` and `to` are inclusive. The provider is responsible for
    /// converting the internal symbol name to the provider's format
    /// (e.g. `SPY` → `"SPY"` for Yahoo, `BTC` → `"BTCUSDT"` for Binance).
    async fn fetch_bars(
        &self,
        symbol: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> anyhow::Result<Vec<OHLCVBar>>;
}

// ---------------------------------------------------------------------------
// Yahoo Finance provider
// ---------------------------------------------------------------------------

const YAHOO_BASE: &str = "https://query2.finance.yahoo.com/v8/finance/chart";

/// Provider that fetches data from Yahoo Finance's v8 chart API.
///
/// No API key required. Rate-limited (~200 req/min per IP).
pub struct YahooFinanceProvider {
    client: Client,
}

/// Top-level response envelope from Yahoo Finance.
#[derive(Debug, Deserialize)]
struct YahooResponse {
    chart: Chart,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Chart {
    result: Option<Vec<ChartResult>>,
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ChartResult {
    meta: Meta,
    timestamp: Vec<i64>,
    indicators: Indicators,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Meta {
    #[serde(rename = "regularMarketTime")]
    regular_market_time: Option<i64>,
    #[serde(rename = "previousClose")]
    previous_close: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct Indicators {
    quote: Vec<Quote>,
}

#[derive(Debug, Deserialize)]
struct Quote {
    open: Vec<Option<f64>>,
    high: Vec<Option<f64>>,
    low: Vec<Option<f64>>,
    close: Vec<Option<f64>>,
    volume: Vec<Option<f64>>,
}

impl YahooFinanceProvider {
    /// Create a new provider with a default HTTP client.
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()
                .expect("reqwest Client should build"),
        }
    }

    /// Build the URL for the Yahoo Finance chart API.
    fn build_url(&self, symbol: &str, from: NaiveDate, to: NaiveDate) -> String {
        let period1 = from.and_hms_opt(0, 0, 0)
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0);
        let period2 = to.and_hms_opt(23, 59, 59)
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0);

        format!(
            "{}/{}?period1={}&period2={}&interval=1d",
            YAHOO_BASE, symbol, period1, period2
        )
    }
}

impl Default for YahooFinanceProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DataProvider for YahooFinanceProvider {
    fn name(&self) -> &str {
        "yahoo-finance"
    }

    async fn fetch_bars(
        &self,
        symbol: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> anyhow::Result<Vec<OHLCVBar>> {
        let url = self.build_url(symbol, from, to);

        let resp: YahooResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Yahoo Finance request failed for {}: {}", symbol, e))?
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Yahoo Finance parse failed for {}: {}", symbol, e))?;

        let result = resp
            .chart
            .result
            .and_then(|r| r.into_iter().next())
            .ok_or_else(|| anyhow::anyhow!("Yahoo Finance returned no data for {}", symbol))?;

        let quote = result
            .indicators
            .quote
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("Yahoo Finance missing quote data for {}", symbol))?;

        let bars: Vec<OHLCVBar> = result
            .timestamp
            .iter()
            .zip(quote.open.into_iter())
            .zip(quote.high.into_iter())
            .zip(quote.low.into_iter())
            .zip(quote.close.into_iter())
            .zip(quote.volume.into_iter())
            .filter_map(|(((((ts, open), high), low), close), volume)| {
                // Skip entries with missing price data
                let open = open?;
                let high = high?;
                let low = low?;
                let close = close?;
                let volume = volume?;

                let date = chrono::DateTime::from_timestamp(*ts, 0)?
                    .date_naive();

                Some(OHLCVBar {
                    symbol: symbol.to_string(),
                    date,
                    open,
                    high,
                    low,
                    close,
                    volume,
                })
            })
            .collect();

        if bars.is_empty() {
            anyhow::bail!("Yahoo Finance returned empty data for {}", symbol);
        }

        Ok(bars)
    }
}

// ---------------------------------------------------------------------------
// Provider registry (future: auto-select based on symbol prefix)
// ---------------------------------------------------------------------------

/// Pick the best provider for a given symbol.
///
/// Rules:
/// - Crypto symbols (BTC, ETH, etc.) → Binance (once implemented)
/// - Everything else → Yahoo Finance
pub fn provider_for_symbol(_symbol: &str) -> Box<dyn DataProvider> {
    // TODO: add BinanceProvider for crypto symbols
    Box::new(YahooFinanceProvider::new())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_yahoo_build_url() {
        let provider = YahooFinanceProvider::new();
        let from = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2025, 1, 5).unwrap();

        let url = provider.build_url("SPY", from, to);
        assert!(url.contains("query2.finance.yahoo.com/v8/finance/chart/SPY"));
        assert!(url.contains("period1="));
        assert!(url.contains("period2="));
        assert!(url.contains("interval=1d"));
    }

    #[test]
    fn test_provider_name() {
        let provider = YahooFinanceProvider::new();
        assert_eq!(provider.name(), "yahoo-finance");
    }

    #[test]
    fn test_provider_for_symbol_default() {
        let provider = provider_for_symbol("SPY");
        assert_eq!(provider.name(), "yahoo-finance");
    }

    #[test]
    fn test_provider_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<YahooFinanceProvider>();
    }
}
