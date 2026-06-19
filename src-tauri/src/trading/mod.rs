//! Core trading engine module
//!
//! This module contains all trading-related logic:
//! - Market data processing
//! - Strategy evaluation
//! - Risk management
//! - Signal generation
//! - Order management

pub mod models;
pub mod market_data;
pub mod strategies;
pub mod risk;
pub mod signals;

/// Trading engine configuration
#[derive(Debug, Clone)]
pub struct TradingConfig {
    pub max_positions: u32,
    pub max_risk_per_trade: f64,
    pub max_portfolio_risk: f64,
    pub default_slippage: f64,
}

impl Default for TradingConfig {
    fn default() -> Self {
        Self {
            max_positions: 10,
            max_risk_per_trade: 0.02,
            max_portfolio_risk: 0.10,
            default_slippage: 0.001,
        }
    }
}
