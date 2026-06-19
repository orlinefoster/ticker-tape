//! Risk management module
//!
//! Position sizing, stop-loss calculation, VaR, drawdown control.

use crate::trading::models::{Portfolio, RiskMetrics};

/// Calculate Value at Risk using the historical method
pub fn calculate_var(bars: &[f64], confidence: f64) -> f64 {
    if bars.is_empty() {
        return 0.0;
    }

    let mut returns: Vec<f64> = bars
        .windows(2)
        .map(|w| (w[1] - w[0]) / w[0])
        .collect();
    returns.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let index = ((1.0 - confidence) * returns.len() as f64).floor() as usize;
    returns[index.clamp(0, returns.len() - 1)]
}

/// Calculate Sharpe ratio
pub fn calculate_sharpe(returns: &[f64], risk_free_rate: f64) -> f64 {
    if returns.is_empty() {
        return 0.0;
    }

    let mean = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
    let std_dev = variance.sqrt();

    if std_dev == 0.0 {
        return 0.0;
    }

    (mean - risk_free_rate) / std_dev * (252.0_f64.sqrt()) // annualized
}

/// Calculate maximum drawdown from a series of portfolio values
pub fn calculate_max_drawdown(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let mut peak = values[0];
    let mut max_dd = 0.0;

    for &v in values {
        if v > peak {
            peak = v;
        }
        let dd = (peak - v) / peak;
        if dd > max_dd {
            max_dd = dd;
        }
    }

    max_dd
}

/// Compute all risk metrics for a portfolio
pub fn compute_risk_metrics(portfolio: &Portfolio) -> RiskMetrics {
    RiskMetrics {
        var_95: 0.0,
        sharpe_ratio: 0.0,
        max_drawdown: 0.0,
        volatility: 0.0,
    }
}
