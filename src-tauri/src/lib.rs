pub mod db;
pub mod trading;
pub mod mcp;
pub mod ollama;

use tauri::Manager;

/// Core Tauri command — health check
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Ticker Tape is running.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("ticker_tape=debug")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize local database
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let db_path = app_handle
                    .path()
                    .app_local_data_dir()
                    .expect("failed to get app data dir")
                    .join("ticker-tape.db");

                if let Err(e) = db::init_db(&db_path).await {
                    tracing::error!("Database initialization failed: {}", e);
                } else {
                    tracing::info!("Database initialized at {:?}", db_path);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
