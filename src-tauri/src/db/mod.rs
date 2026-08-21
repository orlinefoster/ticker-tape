//! Database module — connection management and repository access.
//!
//! Uses a global `OnceCell` to hold the SQLite connection pool.
//! Initialized once at app startup via `init_db()`.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Pool, Sqlite};
use std::path::Path;
use tokio::sync::OnceCell;

pub mod market_data_repo;
pub mod strategy_repo;

pub use market_data_repo::MarketDataRepository;
pub use strategy_repo::StrategyRepository;

/// Global database connection pool — initialized once at app startup.
static DB_POOL: OnceCell<Pool<Sqlite>> = OnceCell::const_new();

/// A persisted strategy configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyConfig {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize the SQLite database at the given path.
///
/// Creates the parent directory if needed, builds a connection pool with
/// WAL journal mode and busy timeout, runs pending migrations, and stores
/// the pool in the global `OnceCell`.
pub async fn init_db(db_path: &Path) -> Result<()> {
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    if !db_path.exists() {
        std::fs::File::create(db_path)?;
    }

    let db_url = format!("sqlite:{}", db_path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Enable WAL mode and set busy timeout for better concurrent access.
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA busy_timeout=5000;")
        .execute(&pool)
        .await
        .map(|_| ())?;

    // Set a connection-level busy timeout as well.
    sqlx::query(&format!("PRAGMA busy_timeout={}", 5000))
        .execute(&pool)
        .await?;

    // Run pending migrations.
    sqlx::migrate!("./migrations").run(&pool).await?;

    DB_POOL
        .set(pool)
        .map_err(|_| anyhow::anyhow!("Database pool already initialized"))?;

    tracing::info!("Database initialized successfully");
    Ok(())
}

/// Get a reference to the global database pool.
///
/// Returns an error if the pool has not been initialized.
pub fn get_db() -> Result<&'static Pool<Sqlite>> {
    DB_POOL
        .get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized. Call init_db() first."))
}
