//! Ticker Tape — Tauri application library.
//!
//! Registers modules, Tauri commands, and the application lifecycle.

pub mod db;
pub mod trading;
pub mod mcp;
pub mod ollama;

use chrono::{NaiveDate, Utc};
use tauri::Manager;

use crate::db::market_data_repo::MarketDataRepository;
use crate::trading::backtest::{BacktestResult, Backtester};
use crate::trading::bar_collection::BarCollection;
use crate::trading::models::{OHLCVBar, Signal};
use crate::trading::strategies::{BollingerBands, MACrossover, RSI, Strategy};

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Core Tauri command — health check.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Ticker Tape is running.", name)
}

/// Fetch market data (OHLCV bars) for a symbol over a given range.
///
/// First checks the local SQLite cache; on miss returns an empty vec
/// (external API fetching is a stub for now).
#[tauri::command]
async fn fetch_market_data(symbol: String, range: String) -> Result<Vec<OHLCVBar>, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;

    let to = Utc::now().date_naive();
    let from = parse_range(&range, to)?;

    let from_str = from.format("%Y-%m-%d").to_string();
    let to_str = to.format("%Y-%m-%d").to_string();

    // Check local cache first.
    let bars = MarketDataRepository::get_bars(pool, &symbol, &from_str, &to_str)
        .await
        .map_err(|e| e.to_string())?;

    if !bars.is_empty() {
        tracing::debug!("Cache hit for {} in range {}", symbol, range);
        return Ok(bars);
    }

    // Cache miss — external API is a stub, return empty for now.
    tracing::warn!("No cached data for {} in range {}", symbol, range);
    // TODO: Call market_data::fetch_historical_data when implemented
    Ok(Vec::new())
}

/// Run a trading strategy on historical data and return generated signals.
///
/// Supported strategies: `ma-crossover`, `bollinger-bands`, `rsi`.
/// Params are flexible JSON, overriding defaults for each strategy.
#[tauri::command]
async fn run_strategy(
    symbol: String,
    strategy: String,
    params: serde_json::Value,
) -> Result<Vec<Signal>, String> {
    let strategy_obj = build_strategy(&strategy, &params)?;

    let pool = db::get_db().map_err(|e| e.to_string())?;
    let bars = fetch_all_bars(pool, &symbol).await.map_err(|e| e.to_string())?;

    let signals = strategy_obj.evaluate(&symbol, &bars).await;
    Ok(signals)
}

/// Run a full backtest of a strategy on historical data.
///
/// Uses the same strategy resolution as `run_strategy`, wraps in `Backtester`,
/// and returns performance metrics.
#[tauri::command]
async fn run_backtest(
    symbol: String,
    strategy: String,
    params: serde_json::Value,
) -> Result<BacktestResult, String> {
    let strategy_obj = build_strategy(&strategy, &params)?;

    let pool = db::get_db().map_err(|e| e.to_string())?;
    let bars = fetch_all_bars(pool, &symbol).await.map_err(|e| e.to_string())?;

    // Build a BarCollection for the backtester.
    let collection =
        BarCollection::new(bars).map_err(|e| format!("Invalid bar data: {}", e))?;

    let backtester = Backtester::new(100_000.0);
    let result = backtester.run(&*strategy_obj, &collection).await;
    Ok(result)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse a human-readable range string into a start date.
fn parse_range(range: &str, to: NaiveDate) -> Result<NaiveDate, String> {
    match range {
        "1m" => Ok(to - chrono::Duration::days(30)),
        "3m" => Ok(to - chrono::Duration::days(90)),
        "1y" => Ok(to - chrono::Duration::days(365)),
        "2y" => Ok(to - chrono::Duration::days(730)),
        "5y" => Ok(to - chrono::Duration::days(1825)),
        _ => Err(format!(
            "Invalid range '{}'. Use: 1m, 3m, 1y, 2y, 5y",
            range
        )),
    }
}

/// Build a strategy instance from its name and JSON params.
fn build_strategy(name: &str, params: &serde_json::Value) -> Result<Box<dyn Strategy>, String> {
    match name {
        "ma-crossover" => {
            let fast = params
                .get("fast")
                .and_then(|v| v.as_i64())
                .unwrap_or(50) as usize;
            let slow = params
                .get("slow")
                .and_then(|v| v.as_i64())
                .unwrap_or(200) as usize;
            Ok(Box::new(MACrossover {
                fast_period: fast,
                slow_period: slow,
            }))
        }
        "bollinger-bands" => {
            let period = params
                .get("period")
                .and_then(|v| v.as_i64())
                .unwrap_or(20) as usize;
            let stddev = params
                .get("stddev")
                .and_then(|v| v.as_f64())
                .unwrap_or(2.0);
            Ok(Box::new(BollingerBands::new(period, stddev)))
        }
        "rsi" => {
            let period = params
                .get("period")
                .and_then(|v| v.as_i64())
                .unwrap_or(14) as usize;
            let overbought = params
                .get("overbought")
                .and_then(|v| v.as_f64())
                .unwrap_or(70.0);
            let oversold = params
                .get("oversold")
                .and_then(|v| v.as_f64())
                .unwrap_or(30.0);
            Ok(Box::new(RSI::new(period, overbought, oversold)))
        }
        _ => Err(format!(
            "Unknown strategy '{}'. Supported: ma-crossover, bollinger-bands, rsi",
            name
        )),
    }
}

/// Fetch ALL bars for a symbol from the database (no date filter).
async fn fetch_all_bars(
    pool: &sqlx::Pool<sqlx::Sqlite>,
    symbol: &str,
) -> anyhow::Result<Vec<OHLCVBar>> {
    // Use a wide date range to get everything.
    MarketDataRepository::get_bars(pool, symbol, "1970-01-01", "2099-12-31").await
}

// ---------------------------------------------------------------------------
// App Entry Point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("ticker_tape=debug")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize local database (blocking on async init).
            let db_path = app
                .path()
                .app_local_data_dir()
                .expect("failed to get app data dir")
                .join("ticker-tape.db");

            if let Err(e) = tauri::async_runtime::block_on(db::init_db(&db_path)) {
                tracing::error!("Database initialization failed: {}", e);
            } else {
                tracing::info!("Database initialized at {:?}", db_path);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_market_data,
            run_strategy,
            run_backtest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
