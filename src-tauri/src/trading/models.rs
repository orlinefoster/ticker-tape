use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// OHLCV bar — the fundamental market data unit
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OHLCVBar {
    pub symbol: String,
    pub date: NaiveDate,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// A trading signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    pub symbol: String,
    pub direction: SignalDirection,
    pub strength: f64,         // 0.0 to 1.0
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source: String,        // strategy name or model that generated it
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SignalDirection {
    Buy,
    Sell,
    Neutral,
}

/// An executed trade / order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub symbol: String,
    pub side: OrderSide,
    pub quantity: f64,
    pub price: f64,
    pub status: OrderStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderStatus {
    Pending,
    Filled,
    Cancelled,
    Rejected,
}

/// Portfolio snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Portfolio {
    pub total_value: f64,
    pub cash: f64,
    pub positions: Vec<Position>,
    pub risk_metrics: RiskMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub quantity: f64,
    pub avg_entry: f64,
    pub current_price: f64,
    pub unrealized_pnl: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskMetrics {
    pub var_95: f64,          // Value at Risk (95%)
    pub sharpe_ratio: f64,
    pub max_drawdown: f64,
    pub volatility: f64,
}
