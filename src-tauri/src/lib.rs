//! Ticker Tape — Tauri application library.
//!
//! Registers modules, Tauri commands, and the application lifecycle.

pub mod analysis;
pub mod db;
pub mod trading;
pub mod mcp;
pub mod ollama;

use chrono::{NaiveDate, Utc};
use tauri::Manager;

use crate::db::market_data_repo::MarketDataRepository;
use crate::trading::backtest::{BacktestResult, Backtester};
use crate::trading::bar_collection::BarCollection;
use crate::trading::market_data;
use crate::trading::models::{OHLCVBar, Signal};
use crate::analysis::elliott_wave::persistence::WaveLabelRepository;
use crate::analysis::elliott_wave::types::WaveLabel;
use crate::analysis::{available_modules, ModuleContext};
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
/// First checks the local SQLite cache; on miss fetches from the
/// appropriate external data provider (Yahoo Finance, Binance, etc.)
/// and caches the result in SQLite.
#[tauri::command]
async fn fetch_market_data(symbol: String, range: String) -> Result<Vec<OHLCVBar>, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;

    let to = Utc::now().date_naive();
    let from = parse_range(&range, to)?;

    let from_str = from.format("%Y-%m-%d").to_string();
    let to_str = to.format("%Y-%m-%d").to_string();

    // 1. Check local cache first.
    let cached = MarketDataRepository::get_bars(pool, &symbol, &from_str, &to_str)
        .await
        .map_err(|e| e.to_string())?;

    if !cached.is_empty() {
        tracing::debug!("Cache hit for {} in range {} ({} bars)", symbol, range, cached.len());
        return Ok(cached);
    }

    // 2. Cache miss — fetch from external provider.
    tracing::info!("Cache miss for {} in range {} — fetching from provider", symbol, range);
    let bars = market_data::fetch_historical_data(&symbol, from, to)
        .await
        .map_err(|e| format!("Failed to fetch {}: {}", symbol, e))?;

    // 3. Store fetched bars in cache (background).
    if let Err(e) = MarketDataRepository::upsert_bars(pool, &bars).await {
        tracing::warn!("Failed to cache bars for {}: {}", symbol, e);
    }

    tracing::info!("Fetched {} bars for {} from provider", bars.len(), symbol);
    Ok(bars)
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

/// Run an analysis module and return its results as JSON.
///
/// Supported modules: `intermarket`, `topology`, `elliott-wave`
#[tauri::command]
async fn run_analysis(
    module: String,
    symbols: Vec<String>,
    parameters: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;

    let ctx = ModuleContext {
        db: pool.clone(),
        symbols,
        parameters,
    };

    let modules = available_modules();
    let analyzer = modules
        .into_iter()
        .find(|m| m.name() == module)
        .ok_or_else(|| format!("Unknown module '{}'", module))?;

    let output = analyzer.analyze(&ctx).await.map_err(|e| e.to_string())?;
    Ok(output.as_json())
}

/// Load persisted wave labels for a symbol.
///
/// Returns existing labels immediately — no recount.
/// The UI calls this on mount to avoid re-running the algorithm.
#[tauri::command]
async fn load_wave_labels(symbol: String) -> Result<Vec<WaveLabel>, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;
    WaveLabelRepository::load_labels(pool, &symbol, "1d")
        .await
        .map_err(|e| e.to_string())
}

/// Save wave labels (after manual edit or auto-count).
///
/// Uses INSERT OR REPLACE — existing labels with the same
/// (symbol, timeframe, degree, label, start_date) are overwritten.
#[tauri::command]
async fn save_wave_labels(labels: Vec<WaveLabel>) -> Result<u64, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;
    WaveLabelRepository::save_labels(pool, &labels)
        .await
        .map_err(|e| e.to_string())
}

/// Trigger a fresh wave count (deletes existing labels first).
#[tauri::command]
async fn recount_waves(symbol: String) -> Result<Vec<WaveLabel>, String> {
    let pool = db::get_db().map_err(|e| e.to_string())?;

    // 1. Delete old labels
    WaveLabelRepository::delete_labels(pool, &symbol, "1d")
        .await
        .map_err(|e| e.to_string())?;

    // 2. Fetch price data
    let to = Utc::now().date_naive();
    let from = to - chrono::Duration::days(730);
    let from_str = from.format("%Y-%m-%d").to_string();
    let to_str = to.format("%Y-%m-%d").to_string();

    let bars = MarketDataRepository::get_bars(pool, &symbol, &from_str, &to_str)
        .await
        .map_err(|e| e.to_string())?;

    if bars.is_empty() {
        return Err(format!("No price data for {}", symbol));
    }

    let dates: Vec<_> = bars.iter().map(|b| b.date).collect();
    let closes: Vec<_> = bars.iter().map(|b| b.close).collect();

    // 3. Count waves
    let (impulse, corrective, _) =
        crate::analysis::elliott_wave::counting::count_waves(&symbol, &dates, &closes, "1d");

    let all_labels: Vec<WaveLabel> = impulse.into_iter().chain(corrective).collect();

    if all_labels.is_empty() {
        return Err(format!("Could not identify wave pattern for {}", symbol));
    }

    // 4. Persist
    WaveLabelRepository::save_labels(pool, &all_labels)
        .await
        .map_err(|e| e.to_string())?;

    Ok(all_labels)
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
            run_analysis,
            load_wave_labels,
            save_wave_labels,
            recount_waves,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
