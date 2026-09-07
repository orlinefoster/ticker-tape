//! Market data repository — CRUD for OHLCV bars in SQLite.
//!
//! Uses the `market_data` table with PRIMARY KEY (symbol, date).

use anyhow::Result;
use chrono::NaiveDate;
use sqlx::{Pool, Row, Sqlite};

use crate::trading::models::OHLCVBar;

/// Repository for market data (OHLCV bars) operations.
pub struct MarketDataRepository;

impl MarketDataRepository {
    /// Insert or replace multiple OHLCV bars.
    ///
    /// Uses INSERT OR REPLACE since the PK is (symbol, date).
    /// Returns the number of rows affected.
    pub async fn upsert_bars(pool: &Pool<Sqlite>, bars: &[OHLCVBar]) -> Result<u64> {
        let mut tx = pool.begin().await?;
        let mut count = 0u64;

        for bar in bars {
            let date_str = bar.date.format("%Y-%m-%d").to_string();
            let result = sqlx::query(
                "INSERT OR REPLACE INTO market_data (symbol, date, open, high, low, close, volume) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )
            .bind(&bar.symbol)
            .bind(&date_str)
            .bind(bar.open)
            .bind(bar.high)
            .bind(bar.low)
            .bind(bar.close)
            .bind(bar.volume)
            .execute(&mut *tx)
            .await?;
            count += result.rows_affected();
        }

        tx.commit().await?;
        Ok(count)
    }

    /// Fetch OHLCV bars for a symbol and date range (inclusive).
    ///
    /// `from` and `to` are ISO-8601 date strings (e.g. "2024-01-01").
    /// Results are sorted by date ascending.
    pub async fn get_bars(
        pool: &Pool<Sqlite>,
        symbol: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<OHLCVBar>> {
        let rows = sqlx::query(
            "SELECT symbol, date, open, high, low, close, volume \
             FROM market_data \
             WHERE symbol = ?1 AND date BETWEEN ?2 AND ?3 \
             ORDER BY date ASC",
        )
        .bind(symbol)
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;

        let bars: Vec<OHLCVBar> = rows
            .iter()
            .map(|row| {
                let date_str: String = row.get("date");
                Ok(OHLCVBar {
                    symbol: row.get("symbol"),
                    date: NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                        .map_err(|e| anyhow::anyhow!("Invalid date '{}': {}", date_str, e))?,
                    open: row.get("open"),
                    high: row.get("high"),
                    low: row.get("low"),
                    close: row.get("close"),
                    volume: row.get("volume"),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(bars)
    }

    /// Get the latest trading date for a symbol.
    ///
    /// Returns `None` if no data exists for the symbol.
    pub async fn get_latest_date(
        pool: &Pool<Sqlite>,
        symbol: &str,
    ) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT MAX(date) FROM market_data WHERE symbol = ?1",
        )
        .bind(symbol)
        .fetch_optional(pool)
        .await?;

        match row {
            Some((Some(date),)) => Ok(Some(date)),
            _ => Ok(None),
        }
    }

    /// Delete bars older than the given date for a symbol.
    ///
    /// Returns the number of deleted rows.
    pub async fn delete_older_than(
        pool: &Pool<Sqlite>,
        symbol: &str,
        date: &str,
    ) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM market_data WHERE symbol = ?1 AND date < ?2",
        )
        .bind(symbol)
        .bind(date)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Delete all cached bars for a specific symbol.
    pub async fn delete_symbol(pool: &Pool<Sqlite>, symbol: &str) -> Result<u64> {
        let result = sqlx::query("DELETE FROM market_data WHERE symbol = ?1")
            .bind(symbol)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// List all cached symbols and their bar counts.
    pub async fn get_cache_overview(
        pool: &Pool<Sqlite>,
    ) -> Result<Vec<(String, i64, Option<String>, Option<String>)>> {
        let rows: Vec<(String, i64, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT symbol, COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date \
             FROM market_data \
             GROUP BY symbol \
             ORDER BY symbol ASC",
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use sqlx::sqlite::SqlitePoolOptions;

    fn make_bar(date_str: &str, close: f64) -> OHLCVBar {
        OHLCVBar {
            symbol: "TEST".to_string(),
            date: NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap(),
            open: close,
            high: close,
            low: close,
            close,
            volume: 1000.0,
        }
    }

    async fn setup_pool() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory pool");

        // Create the market_data table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS market_data (
                symbol      TEXT NOT NULL,
                date        TEXT NOT NULL,
                open        REAL NOT NULL,
                high        REAL NOT NULL,
                low         REAL NOT NULL,
                close       REAL NOT NULL,
                volume      REAL NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (symbol, date)
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_upsert_and_get_bars() {
        let pool = setup_pool().await;

        let bars = vec![
            make_bar("2024-01-01", 100.0),
            make_bar("2024-01-02", 102.0),
            make_bar("2024-01-03", 101.0),
        ];

        let count = MarketDataRepository::upsert_bars(&pool, &bars)
            .await
            .unwrap();
        assert_eq!(count, 3);

        let fetched = MarketDataRepository::get_bars(&pool, "TEST", "2024-01-01", "2024-01-03")
            .await
            .unwrap();
        assert_eq!(fetched.len(), 3);
        assert_eq!(fetched[0].close, 100.0);
        assert_eq!(fetched[2].close, 101.0);
    }

    #[tokio::test]
    async fn test_upsert_replaces_existing() {
        let pool = setup_pool().await;

        let bars = vec![make_bar("2024-01-01", 100.0)];
        MarketDataRepository::upsert_bars(&pool, &bars).await.unwrap();

        let updated = vec![OHLCVBar {
            close: 105.0,
            ..make_bar("2024-01-01", 100.0)
        }];
        let count = MarketDataRepository::upsert_bars(&pool, &updated)
            .await
            .unwrap();
        assert_eq!(count, 1);

        let fetched = MarketDataRepository::get_bars(&pool, "TEST", "2024-01-01", "2024-01-01")
            .await
            .unwrap();
        assert_eq!(fetched.len(), 1);
        assert_eq!(fetched[0].close, 105.0);
    }

    #[tokio::test]
    async fn test_get_bars_empty_db() {
        let pool = setup_pool().await;

        let fetched = MarketDataRepository::get_bars(&pool, "NONEXISTENT", "2024-01-01", "2024-01-10")
            .await
            .unwrap();
        assert!(fetched.is_empty());
    }

    #[tokio::test]
    async fn test_get_bars_date_range() {
        let pool = setup_pool().await;

        let bars = vec![
            make_bar("2024-01-01", 100.0),
            make_bar("2024-01-02", 102.0),
            make_bar("2024-01-03", 101.0),
            make_bar("2024-01-04", 103.0),
        ];
        MarketDataRepository::upsert_bars(&pool, &bars).await.unwrap();

        let fetched = MarketDataRepository::get_bars(&pool, "TEST", "2024-01-02", "2024-01-03")
            .await
            .unwrap();
        assert_eq!(fetched.len(), 2);
        assert_eq!(fetched[0].date, NaiveDate::from_ymd_opt(2024, 1, 2).unwrap());
        assert_eq!(fetched[1].date, NaiveDate::from_ymd_opt(2024, 1, 3).unwrap());
    }

    #[tokio::test]
    async fn test_get_latest_date() {
        let pool = setup_pool().await;

        // Empty DB
        let latest = MarketDataRepository::get_latest_date(&pool, "TEST")
            .await
            .unwrap();
        assert!(latest.is_none());

        // Insert some data
        let bars = vec![
            make_bar("2024-01-01", 100.0),
            make_bar("2024-01-05", 102.0),
            make_bar("2024-01-03", 101.0),
        ];
        MarketDataRepository::upsert_bars(&pool, &bars).await.unwrap();

        let latest = MarketDataRepository::get_latest_date(&pool, "TEST")
            .await
            .unwrap();
        assert_eq!(latest, Some("2024-01-05".to_string()));
    }

    #[tokio::test]
    async fn test_delete_older_than() {
        let pool = setup_pool().await;

        let bars = vec![
            make_bar("2024-01-01", 100.0),
            make_bar("2024-01-02", 102.0),
            make_bar("2024-01-03", 101.0),
            make_bar("2024-01-04", 103.0),
        ];
        MarketDataRepository::upsert_bars(&pool, &bars).await.unwrap();

        let deleted = MarketDataRepository::delete_older_than(&pool, "TEST", "2024-01-03")
            .await
            .unwrap();
        assert_eq!(deleted, 2);

        let remaining = MarketDataRepository::get_bars(&pool, "TEST", "2024-01-01", "2024-01-04")
            .await
            .unwrap();
        assert_eq!(remaining.len(), 2);
        assert_eq!(remaining[0].date, NaiveDate::from_ymd_opt(2024, 1, 3).unwrap());
        assert_eq!(remaining[1].date, NaiveDate::from_ymd_opt(2024, 1, 4).unwrap());
    }

    #[tokio::test]
    async fn test_delete_older_than_no_match() {
        let pool = setup_pool().await;

        let bars = vec![make_bar("2024-01-05", 100.0)];
        MarketDataRepository::upsert_bars(&pool, &bars).await.unwrap();

        let deleted = MarketDataRepository::delete_older_than(&pool, "TEST", "2024-01-01")
            .await
            .unwrap();
        assert_eq!(deleted, 0);
    }
}
