//! Persistence layer for Elliott Wave labels.
//!
//! This is the KEY piece that prevents re-counting every time:
//! wave labels are stored in SQLite and loaded on module init.
//! Only explicit "recount" actions run the algorithm again.

use anyhow::Result;
use chrono::NaiveDate;
use sqlx::{Pool, Row, Sqlite};

use super::types::WaveLabel;

/// Repository for reading/writing wave labels to SQLite.
pub struct WaveLabelRepository;

impl WaveLabelRepository {
    /// Load wave labels for a symbol + timeframe.
    ///
    /// Returns empty vec if no labels exist (first time or recount needed).
    /// Sorted by start_date ascending.
    pub async fn load_labels(
        pool: &Pool<Sqlite>,
        symbol: &str,
        timeframe: &str,
    ) -> Result<Vec<WaveLabel>> {
        let rows = sqlx::query(
            "SELECT id, symbol, timeframe, wave_degree, wave_label, \
                    start_date, end_date, price_start, price_end, \
                    confidence, is_automatic, notes \
             FROM wave_labels \
             WHERE symbol = ?1 AND timeframe = ?2 \
             ORDER BY start_date ASC",
        )
        .bind(symbol)
        .bind(timeframe)
        .fetch_all(pool)
        .await?;

        let labels: Vec<WaveLabel> = rows
            .iter()
            .map(|row| {
                let start: String = row.get("start_date");
                let end: Option<String> = row.get("end_date");
                Ok(WaveLabel {
                    id: Some(row.get::<i64, _>("id")),
                    symbol: row.get("symbol"),
                    timeframe: row.get("timeframe"),
                    wave_degree: row.get("wave_degree"),
                    wave_label: row.get("wave_label"),
                    start_date: NaiveDate::parse_from_str(&start, "%Y-%m-%d")?,
                    end_date: match end {
                        Some(s) => Some(NaiveDate::parse_from_str(&s, "%Y-%m-%d")?),
                        None => None,
                    },
                    price_start: row.get("price_start"),
                    price_end: row.get("price_end"),
                    confidence: row.get("confidence"),
                    is_automatic: row.get::<i32, _>("is_automatic") != 0,
                    notes: row.get("notes"),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(labels)
    }

    /// Save a batch of wave labels (INSERT OR REPLACE).
    ///
    /// Uses the UNIQUE constraint to upsert — manual edits with the same
    /// (symbol, timeframe, degree, label, start_date) will overwrite the
    /// automated labels.
    pub async fn save_labels(
        pool: &Pool<Sqlite>,
        labels: &[WaveLabel],
    ) -> Result<u64> {
        let mut tx = pool.begin().await?;
        let mut count = 0u64;

        for label in labels {
            let start_str = label.start_date.format("%Y-%m-%d").to_string();
            let end_str = label.end_date.map(|d| d.format("%Y-%m-%d").to_string());

            let result = sqlx::query(
                "INSERT OR REPLACE INTO wave_labels \
                 (symbol, timeframe, wave_degree, wave_label, start_date, \
                  end_date, price_start, price_end, confidence, is_automatic, notes) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )
            .bind(&label.symbol)
            .bind(&label.timeframe)
            .bind(&label.wave_degree)
            .bind(&label.wave_label)
            .bind(&start_str)
            .bind(end_str)
            .bind(label.price_start)
            .bind(label.price_end)
            .bind(label.confidence)
            .bind(label.is_automatic as i32)
            .bind(&label.notes)
            .execute(&mut *tx)
            .await?;
            count += result.rows_affected();
        }

        tx.commit().await?;
        Ok(count)
    }

    /// Delete all wave labels for a symbol + timeframe (for recount).
    pub async fn delete_labels(
        pool: &Pool<Sqlite>,
        symbol: &str,
        timeframe: &str,
    ) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM wave_labels WHERE symbol = ?1 AND timeframe = ?2",
        )
        .bind(symbol)
        .bind(timeframe)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Check if wave labels already exist for a symbol + timeframe.
    pub async fn has_labels(
        pool: &Pool<Sqlite>,
        symbol: &str,
        timeframe: &str,
    ) -> Result<bool> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wave_labels WHERE symbol = ?1 AND timeframe = ?2",
        )
        .bind(symbol)
        .bind(timeframe)
        .fetch_one(pool)
        .await?;

        Ok(row.0 > 0)
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

    async fn setup_pool() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS wave_labels (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol      TEXT NOT NULL,
                timeframe   TEXT NOT NULL DEFAULT '1d',
                wave_degree TEXT NOT NULL,
                wave_label  TEXT NOT NULL,
                start_date  TEXT NOT NULL,
                end_date    TEXT,
                price_start REAL,
                price_end   REAL,
                confidence  REAL NOT NULL DEFAULT 0.0,
                is_automatic INTEGER NOT NULL DEFAULT 1,
                notes       TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(symbol, timeframe, wave_degree, wave_label, start_date)
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    fn make_label(
        symbol: &str,
        wave_label: &str,
        start: &str,
        end: Option<&str>,
    ) -> WaveLabel {
        WaveLabel {
            id: None,
            symbol: symbol.to_string(),
            timeframe: "1d".to_string(),
            wave_degree: "primary".to_string(),
            wave_label: wave_label.to_string(),
            start_date: NaiveDate::parse_from_str(start, "%Y-%m-%d").unwrap(),
            end_date: end.map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()),
            price_start: None,
            price_end: None,
            confidence: 0.8,
            is_automatic: true,
            notes: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_load_labels() {
        let pool = setup_pool().await;

        let labels = vec![
            make_label("SPY", "1", "2024-01-01", Some("2024-02-01")),
            make_label("SPY", "2", "2024-02-01", Some("2024-03-01")),
            make_label("SPY", "3", "2024-03-01", Some("2024-06-01")),
        ];

        let count = WaveLabelRepository::save_labels(&pool, &labels)
            .await
            .unwrap();
        assert_eq!(count, 3);

        let loaded = WaveLabelRepository::load_labels(&pool, "SPY", "1d")
            .await
            .unwrap();
        assert_eq!(loaded.len(), 3);
        assert_eq!(loaded[0].wave_label, "1");
        assert_eq!(loaded[2].wave_label, "3");
    }

    #[tokio::test]
    async fn test_has_labels() {
        let pool = setup_pool().await;

        assert!(!WaveLabelRepository::has_labels(&pool, "SPY", "1d").await.unwrap());

        WaveLabelRepository::save_labels(&pool, &[make_label("SPY", "1", "2024-01-01", None)])
            .await
            .unwrap();

        assert!(WaveLabelRepository::has_labels(&pool, "SPY", "1d").await.unwrap());
    }

    #[tokio::test]
    async fn test_delete_labels() {
        let pool = setup_pool().await;

        WaveLabelRepository::save_labels(&pool, &[make_label("SPY", "1", "2024-01-01", None)])
            .await
            .unwrap();

        let deleted = WaveLabelRepository::delete_labels(&pool, "SPY", "1d")
            .await
            .unwrap();
        assert_eq!(deleted, 1);

        assert!(!WaveLabelRepository::has_labels(&pool, "SPY", "1d").await.unwrap());
    }

    #[tokio::test]
    async fn test_load_empty_when_no_labels() {
        let pool = setup_pool().await;
        let loaded = WaveLabelRepository::load_labels(&pool, "SPY", "1d")
            .await
            .unwrap();
        assert!(loaded.is_empty());
    }

    #[tokio::test]
    async fn test_replace_existing_label() {
        let pool = setup_pool().await;

        let label = make_label("SPY", "1", "2024-01-01", Some("2024-02-01"));
        WaveLabelRepository::save_labels(&pool, &[label]).await.unwrap();

        // Replace with different end date
        let updated = WaveLabel {
            end_date: Some(NaiveDate::from_ymd_opt(2024, 2, 15).unwrap()),
            ..make_label("SPY", "1", "2024-01-01", None)
        };
        let count = WaveLabelRepository::save_labels(&pool, &[updated])
            .await
            .unwrap();
        assert_eq!(count, 1);

        let loaded = WaveLabelRepository::load_labels(&pool, "SPY", "1d")
            .await
            .unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(
            loaded[0].end_date,
            Some(NaiveDate::from_ymd_opt(2024, 2, 15).unwrap())
        );
    }
}
