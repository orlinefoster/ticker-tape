//! Strategy repository — CRUD for strategy configurations in SQLite.
//!
//! Uses the `strategies` table with TEXT PRIMARY KEY (id).

use anyhow::Result;
use sqlx::{Pool, Row, Sqlite};

use crate::db::StrategyConfig;

/// Repository for strategy configuration operations.
pub struct StrategyRepository;

impl StrategyRepository {
    /// Save a strategy configuration (insert or replace).
    pub async fn save(pool: &Pool<Sqlite>, strategy: &StrategyConfig) -> Result<()> {
        let config_str = strategy.config.to_string();
        sqlx::query(
            "INSERT OR REPLACE INTO strategies (id, name, description, config) \
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&strategy.id)
        .bind(&strategy.name)
        .bind(&strategy.description)
        .bind(&config_str)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Retrieve all strategy configurations.
    pub async fn get_all(pool: &Pool<Sqlite>) -> Result<Vec<StrategyConfig>> {
        let rows = sqlx::query(
            "SELECT id, name, description, config, created_at, updated_at \
             FROM strategies ORDER BY name ASC",
        )
        .fetch_all(pool)
        .await?;

        rows.iter()
            .map(|row| Self::row_to_strategy(row))
            .collect()
    }

    /// Retrieve a single strategy configuration by ID.
    pub async fn get_by_id(pool: &Pool<Sqlite>, id: &str) -> Result<Option<StrategyConfig>> {
        let row = sqlx::query(
            "SELECT id, name, description, config, created_at, updated_at \
             FROM strategies WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        row.as_ref()
            .map(|r| Self::row_to_strategy(r))
            .transpose()
    }

    /// Update only the config JSON for a strategy.
    pub async fn update_config(
        pool: &Pool<Sqlite>,
        id: &str,
        config: &serde_json::Value,
    ) -> Result<()> {
        let config_str = config.to_string();
        sqlx::query(
            "UPDATE strategies SET config = ?1, updated_at = datetime('now') WHERE id = ?2",
        )
        .bind(&config_str)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete a strategy by ID.
    ///
    /// Returns `true` if a row was actually deleted.
    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM strategies WHERE id = ?1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn row_to_strategy(row: &sqlx::sqlite::SqliteRow) -> Result<StrategyConfig> {
        let config_str: String = row.get("config");
        let config: serde_json::Value = serde_json::from_str(&config_str)
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        Ok(StrategyConfig {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            config,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::StrategyConfig;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS strategies (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                description TEXT,
                config      TEXT NOT NULL DEFAULT '{}',
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    fn test_strategy(id: &str) -> StrategyConfig {
        StrategyConfig {
            id: id.to_string(),
            name: format!("Strategy {}", id),
            description: Some(format!("Description for {}", id)),
            config: serde_json::json!({"param": 42}),
            created_at: "2024-01-01 00:00:00".to_string(),
            updated_at: "2024-01-01 00:00:00".to_string(),
        }
    }

    #[tokio::test]
    async fn test_save_and_get_by_id() {
        let pool = setup_pool().await;
        let strategy = test_strategy("test-1");

        StrategyRepository::save(&pool, &strategy).await.unwrap();

        let fetched = StrategyRepository::get_by_id(&pool, "test-1")
            .await
            .unwrap()
            .expect("Expected strategy to exist");
        assert_eq!(fetched.id, "test-1");
        assert_eq!(fetched.name, "Strategy test-1");
        assert_eq!(fetched.config.get("param").and_then(|v| v.as_i64()), Some(42));
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = setup_pool().await;
        let fetched = StrategyRepository::get_by_id(&pool, "nonexistent")
            .await
            .unwrap();
        assert!(fetched.is_none());
    }

    #[tokio::test]
    async fn test_get_all() {
        let pool = setup_pool().await;

        StrategyRepository::save(&pool, &test_strategy("a")).await.unwrap();
        StrategyRepository::save(&pool, &test_strategy("b")).await.unwrap();
        StrategyRepository::save(&pool, &test_strategy("c")).await.unwrap();

        let all = StrategyRepository::get_all(&pool).await.unwrap();
        assert_eq!(all.len(), 3);
    }

    #[tokio::test]
    async fn test_get_all_empty() {
        let pool = setup_pool().await;
        let all = StrategyRepository::get_all(&pool).await.unwrap();
        assert!(all.is_empty());
    }

    #[tokio::test]
    async fn test_update_config() {
        let pool = setup_pool().await;
        let strategy = test_strategy("updatable");
        StrategyRepository::save(&pool, &strategy).await.unwrap();

        let new_config = serde_json::json!({"param": 99, "extra": true});
        StrategyRepository::update_config(&pool, "updatable", &new_config)
            .await
            .unwrap();

        let fetched = StrategyRepository::get_by_id(&pool, "updatable")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(fetched.config.get("param").and_then(|v| v.as_i64()), Some(99));
        assert_eq!(
            fetched.config.get("extra").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[tokio::test]
    async fn test_update_config_non_existent() {
        let pool = setup_pool().await;
        // Should not error when updating non-existent strategy
        let config = serde_json::json!({"test": true});
        StrategyRepository::update_config(&pool, "ghost", &config)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = setup_pool().await;
        let strategy = test_strategy("delete-me");
        StrategyRepository::save(&pool, &strategy).await.unwrap();

        let deleted = StrategyRepository::delete(&pool, "delete-me").await.unwrap();
        assert!(deleted);

        let fetched = StrategyRepository::get_by_id(&pool, "delete-me")
            .await
            .unwrap();
        assert!(fetched.is_none());
    }

    #[tokio::test]
    async fn test_delete_non_existent() {
        let pool = setup_pool().await;
        let deleted = StrategyRepository::delete(&pool, "ghost").await.unwrap();
        assert!(!deleted);
    }
}
