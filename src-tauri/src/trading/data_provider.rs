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

/// Error type for symbol validation and data provider requests.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DataProviderError {
    InvalidSymbol(String),
}

impl std::fmt::Display for DataProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DataProviderError::InvalidSymbol(s) => {
                write!(f, "Data provider request rejected invalid symbol '{}'", s)
            }
        }
    }
}

impl std::error::Error for DataProviderError {}

/// Validate and normalize a ticker symbol (uppercase, trimmed, 1..=24 chars, safe charset).
pub fn validate_symbol(symbol: &str) -> Result<String, DataProviderError> {
    let clean = symbol.trim().to_uppercase();
    if clean.is_empty() || clean.len() > 24 || clean.contains("..") {
        return Err(DataProviderError::InvalidSymbol(symbol.to_string()));
    }
    let valid_chars = clean.chars().all(|c| {
        c.is_ascii_uppercase()
            || c.is_ascii_digit()
            || matches!(c, '.' | '-' | '^' | '=' | '_')
    });
    if !valid_chars {
        return Err(DataProviderError::InvalidSymbol(symbol.to_string()));
    }
    Ok(clean)
}

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
    /// Create a new provider with a 15-second timeout HTTP client.
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("reqwest Client should build"),
        }
    }

    /// Build the URL for the Yahoo Finance chart API after validating the symbol.
    pub fn build_url(&self, symbol: &str, from: NaiveDate, to: NaiveDate) -> Result<String, DataProviderError> {
        let clean_symbol = validate_symbol(symbol)?;
        let period1 = from.and_hms_opt(0, 0, 0)
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0);
        let period2 = to.and_hms_opt(23, 59, 59)
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0);

        Ok(format!(
            "{}/{}?period1={}&period2={}&interval=1d",
            YAHOO_BASE, clean_symbol, period1, period2
        ))
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
        let clean_symbol = validate_symbol(symbol)?;
        let url = self.build_url(&clean_symbol, from, to)?;

        let resp: YahooResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Yahoo Finance request failed for {}: {}", clean_symbol, e))?
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Yahoo Finance parse failed for {}: {}", clean_symbol, e))?;

        let result = resp
            .chart
            .result
            .and_then(|r| r.into_iter().next())
            .ok_or_else(|| anyhow::anyhow!("Yahoo Finance returned no data for {}", clean_symbol))?;

        let quote = result
            .indicators
            .quote
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("Yahoo Finance missing quote data for {}", clean_symbol))?;

        let bars: Vec<OHLCVBar> = result
            .timestamp
            .iter()
            .zip(quote.open)
            .zip(quote.high)
            .zip(quote.low)
            .zip(quote.close)
            .zip(quote.volume)
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
                    symbol: clean_symbol.clone(),
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
            anyhow::bail!("Yahoo Finance returned empty data for {}", clean_symbol);
        }

        Ok(bars)
    }
}

// ---------------------------------------------------------------------------
// Binance provider
// ---------------------------------------------------------------------------

const BINANCE_BASE: &str = "https://api.binance.com/api/v3/klines";

/// Provider that fetches historical crypto OHLCV bars from Binance API.
///
/// No API key required for public market data.
pub struct BinanceProvider {
    client: Client,
}

impl BinanceProvider {
    /// Create a new Binance provider with custom timeouts.
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("ticker-tape/0.1.0")
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("reqwest Client should build"),
        }
    }

    /// Normalise internal symbol to Binance symbol format (e.g. "BTC" -> "BTCUSDT", "BTCUSDT" -> "BTCUSDT")
    pub fn normalise_symbol(symbol: &str) -> String {
        let clean = symbol.trim().to_uppercase();
        if clean.ends_with("USDT")
            || clean.ends_with("BUSD")
            || clean.ends_with("FDUSD")
            || (clean.len() > 4 && (clean.ends_with("BTC") || clean.ends_with("ETH")))
        {
            clean
        } else {
            format!("{}USDT", clean)
        }
    }

    /// Build the URL for Binance Klines API after validating the symbol.
    pub fn build_url(&self, symbol: &str, from: NaiveDate, to: NaiveDate) -> Result<String, DataProviderError> {
        let valid = validate_symbol(symbol)?;
        let binance_symbol = Self::normalise_symbol(&valid);
        let start_time = from
            .and_hms_opt(0, 0, 0)
            .map(|dt| dt.and_utc().timestamp_millis())
            .unwrap_or(0);
        let end_time = to
            .and_hms_opt(23, 59, 59)
            .map(|dt| dt.and_utc().timestamp_millis())
            .unwrap_or(0);

        Ok(format!(
            "{}?symbol={}&interval=1d&startTime={}&endTime={}&limit=1000",
            BINANCE_BASE, binance_symbol, start_time, end_time
        ))
    }
}

impl Default for BinanceProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DataProvider for BinanceProvider {
    fn name(&self) -> &str {
        "binance"
    }

    async fn fetch_bars(
        &self,
        symbol: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> anyhow::Result<Vec<OHLCVBar>> {
        let clean_symbol = validate_symbol(symbol)?;
        let url = self.build_url(&clean_symbol, from, to)?;

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Binance request failed for {}: {}", clean_symbol, e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("Binance returned error [{status}]: {text}");
        }

        let raw_klines: Vec<Vec<serde_json::Value>> = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Binance parse failed for {}: {}", clean_symbol, e))?;

        let mut bars = Vec::with_capacity(raw_klines.len());

        for k in raw_klines {
            if k.len() < 6 {
                continue;
            }

            let open_time_ms = k[0]
                .as_i64()
                .ok_or_else(|| anyhow::anyhow!("Missing openTime in Binance candle"))?;

            let date = chrono::DateTime::from_timestamp_millis(open_time_ms)
                .map(|dt| dt.date_naive())
                .ok_or_else(|| anyhow::anyhow!("Invalid timestamp in Binance candle: {open_time_ms}"))?;

            let parse_f64 = |val: &serde_json::Value| -> Option<f64> {
                if let Some(s) = val.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    val.as_f64()
                }
            };

            let open = parse_f64(&k[1]).unwrap_or(0.0);
            let high = parse_f64(&k[2]).unwrap_or(0.0);
            let low = parse_f64(&k[3]).unwrap_or(0.0);
            let close = parse_f64(&k[4]).unwrap_or(0.0);
            let volume = parse_f64(&k[5]).unwrap_or(0.0);

            bars.push(OHLCVBar {
                symbol: clean_symbol.clone(),
                date,
                open,
                high,
                low,
                close,
                volume,
            });
        }

        if bars.is_empty() {
            anyhow::bail!("Binance returned empty data for {}", clean_symbol);
        }

        Ok(bars)
    }
}

// ---------------------------------------------------------------------------
// Provider registry & routing
// ---------------------------------------------------------------------------

/// Helper to check if a symbol represents a cryptocurrency
pub fn is_crypto_symbol(symbol: &str) -> bool {
    let s = symbol.trim().to_uppercase();
    s.ends_with("USDT")
        || s.ends_with("BUSD")
        || s.ends_with("FDUSD")
        || matches!(
            s.as_str(),
            "BTC"
                | "ETH"
                | "SOL"
                | "BNB"
                | "XRP"
                | "ADA"
                | "DOGE"
                | "AVAX"
                | "DOT"
                | "LINK"
                | "MATIC"
                | "NEAR"
                | "SUI"
                | "APT"
                | "ARB"
                | "OP"
                | "RENDER"
                | "FET"
        )
}

/// Pick the best provider for a given symbol.
///
/// Rules:
/// - Crypto symbols (BTC, ETH, BTCUSDT, etc.) → Binance
/// - Everything else → Yahoo Finance
pub fn provider_for_symbol(symbol: &str) -> Box<dyn DataProvider> {
    if is_crypto_symbol(symbol) {
        Box::new(BinanceProvider::new())
    } else {
        Box::new(YahooFinanceProvider::new())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_symbol() {
        assert_eq!(validate_symbol("  spy ").unwrap(), "SPY");
        assert_eq!(validate_symbol("BRK.B").unwrap(), "BRK.B");
        assert_eq!(validate_symbol("BTC-USD").unwrap(), "BTC-USD");
        assert_eq!(validate_symbol("^GSPC").unwrap(), "^GSPC");
        assert_eq!(validate_symbol("GC=F").unwrap(), "GC=F");

        assert!(validate_symbol("").is_err());
        assert!(validate_symbol("   ").is_err());
        assert!(validate_symbol("SPY/../../etc/passwd").is_err());
        assert!(validate_symbol("AAPL?interval=1m&foo=bar").is_err());
        assert!(validate_symbol("A..B").is_err());
        assert!(validate_symbol(&"A".repeat(25)).is_err());
    }

    #[test]
    fn test_yahoo_build_url() {
        let provider = YahooFinanceProvider::new();
        let from = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2025, 1, 5).unwrap();

        let url = provider.build_url("spy", from, to).unwrap();
        assert!(url.contains("query2.finance.yahoo.com/v8/finance/chart/SPY"));
        assert!(url.contains("period1="));
        assert!(url.contains("period2="));
        assert!(url.contains("interval=1d"));

        assert!(provider.build_url("SPY/../../admin", from, to).is_err());
    }

    #[test]
    fn test_binance_build_url() {
        let provider = BinanceProvider::new();
        let from = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2025, 1, 5).unwrap();

        let url = provider.build_url("btc", from, to).unwrap();
        assert!(url.contains("api.binance.com/api/v3/klines"));
        assert!(url.contains("symbol=BTCUSDT"));
        assert!(url.contains("interval=1d"));
        assert!(url.contains("startTime="));

        assert!(provider.build_url("BTC&limit=1", from, to).is_err());
    }

    #[test]
    fn test_binance_normalise_symbol() {
        assert_eq!(BinanceProvider::normalise_symbol("BTC"), "BTCUSDT");
        assert_eq!(BinanceProvider::normalise_symbol("btcusdt"), "BTCUSDT");
        assert_eq!(BinanceProvider::normalise_symbol("ETHUSDT"), "ETHUSDT");
        assert_eq!(BinanceProvider::normalise_symbol("sol"), "SOLUSDT");
    }

    #[test]
    fn test_provider_routing() {
        let p1 = provider_for_symbol("BTC");
        assert_eq!(p1.name(), "binance");

        let p2 = provider_for_symbol("ETHUSDT");
        assert_eq!(p2.name(), "binance");

        let p3 = provider_for_symbol("SPY");
        assert_eq!(p3.name(), "yahoo-finance");

        let p4 = provider_for_symbol("AAPL");
        assert_eq!(p4.name(), "yahoo-finance");
    }

    #[test]
    fn test_provider_name() {
        let provider = YahooFinanceProvider::new();
        assert_eq!(provider.name(), "yahoo-finance");

        let binance = BinanceProvider::new();
        assert_eq!(binance.name(), "binance");
    }

    #[test]
    fn test_provider_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<YahooFinanceProvider>();
        assert_send_sync::<BinanceProvider>();
    }
}
