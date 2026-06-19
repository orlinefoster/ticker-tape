use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Pool, Sqlite};
use std::path::Path;
use anyhow::Result;

/// Global database pool
static mut DB_POOL: Option<Pool<Sqlite>> = None;

/// Initialize the SQLite database at the given path
pub async fn init_db(db_path: &Path) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let db_url = format!("sqlite:{}", db_path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    unsafe {
        DB_POOL = Some(pool);
    }

    Ok(())
}

/// Get a reference to the global database pool
pub fn get_db() -> Option<&'static Pool<Sqlite>> {
    unsafe { DB_POOL.as_ref() }
}
