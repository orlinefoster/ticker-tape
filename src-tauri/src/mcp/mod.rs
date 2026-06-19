//! MCP (Model Context Protocol) Server
//!
//! Exposes trading system capabilities to AI agents (like opencode)
//! via the Model Context Protocol.
//!
//! This allows opencode to:
//! - Query market data
//! - Run analysis
//! - Check portfolio status
//! - Execute trades (with authorization)

use serde::{Deserialize, Serialize};

/// MCP Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// Available MCP tools exposed by the trading system
pub fn get_available_tools() -> Vec<MCPTool> {
    vec![
        MCPTool {
            name: "get_market_data".to_string(),
            description: "Fetch OHLCV data for a given symbol and time range".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "range": {"type": "string", "enum": ["1d", "1w", "1m", "3m", "1y"]}
                },
                "required": ["symbol"]
            }),
        },
        MCPTool {
            name: "analyze_strategy".to_string(),
            description: "Run a strategy on a symbol and return signals".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "strategy": {"type": "string"},
                    "parameters": {"type": "object"}
                },
                "required": ["symbol", "strategy"]
            }),
        },
        MCPTool {
            name: "get_portfolio".to_string(),
            description: "Get current portfolio status, positions, and risk metrics".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        MCPTool {
            name: "run_backtest".to_string(),
            description: "Run a backtest of a strategy on historical data".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "symbols": {"type": "array", "items": {"type": "string"}},
                    "strategy": {"type": "string"},
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "initial_capital": {"type": "number"}
                },
                "required": ["symbols", "strategy", "from", "to"]
            }),
        },
    ]
}
