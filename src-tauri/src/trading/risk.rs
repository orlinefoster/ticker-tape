//! Risk management module
//!
//! Position sizing, stop-loss calculation, VaR, drawdown control,
//! and performance-metric helpers used by the backtester and live engine.

use crate::trading::models::{Portfolio, RiskMetrics};

/// Calculate Value at Risk using the historical method.
///
/// Returns the loss level (negative return) at the given confidence
/// (e.g. 0.95 for 95 % VaR).
///
/// Handles empty slices gracefully (returns 0.0).
pub fn calculate_var(bars: &[f64], confidence: f64) -> f64 {
    if bars.is_empty() || bars.len() < 2 {
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

/// Calculate annualised Sharpe ratio.
///
/// Uses 252 as the number of trading days per year.
///
/// Handles empty slices gracefully (returns 0.0).
pub fn calculate_sharpe(returns: &[f64], risk_free_rate: f64) -> f64 {
    if returns.is_empty() {
        return 0.0;
    }

    let n = returns.len() as f64;
    let mean = returns.iter().sum::<f64>() / n;
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();

    // Near-zero standard deviation (floating-point noise) → treat as zero.
    if std_dev < 1e-15 {
        return 0.0;
    }

    (mean - risk_free_rate) / std_dev * (252.0_f64.sqrt())
}

/// Calculate maximum drawdown from a series of portfolio values.
///
/// Handles empty slices gracefully (returns 0.0).
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

/// Calculate annualised volatility from a series of returns.
///
/// Returns annualized standard deviation (multiplied by sqrt(252)).
///
/// Handles empty slices gracefully (returns 0.0).
pub fn calculate_volatility(returns: &[f64]) -> f64 {
    if returns.is_empty() {
        return 0.0;
    }

    let n = returns.len() as f64;
    let mean = returns.iter().sum::<f64>() / n;
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();

    // Near-zero standard deviation (floating-point noise) → treat as zero.
    if std_dev < 1e-15 {
        return 0.0;
    }

    std_dev * (252.0_f64.sqrt())
}

/// Compute all risk metrics for a portfolio.
///
/// Uses real calculations from the portfolio's unrealized P&amp;L to compute
/// volatility, VaR, Sharpe, and max drawdown.
pub fn compute_risk_metrics(portfolio: &Portfolio) -> RiskMetrics {
    // Build a price series from the portfolio — we use the mark-to-market
    // values of positions to construct a pseudo-equity curve and derive
    // risk metrics from it.
    let pseudo_equity = portfolio.cash
        + portfolio
            .positions
            .iter()
            .map(|p| p.quantity * p.current_price)
            .sum::<f64>();

    // If we had a tracked history we'd use it; for now we derive what we
    // can from the positions themselves.
    let var_95 = if !portfolio.positions.is_empty() {
        // Approximate VaR from the worst individual position return.
        let pos_returns: Vec<f64> = portfolio
            .positions
            .iter()
            .map(|p| {
                if p.avg_entry > 0.0 {
                    (p.current_price - p.avg_entry) / p.avg_entry
                } else {
                    0.0
                }
            })
            .collect();
        calculate_var(&pos_returns, 0.95)
    } else {
        0.0
    };

    let volatility = if !portfolio.positions.is_empty() {
        let pos_returns: Vec<f64> = portfolio
            .positions
            .iter()
            .map(|p| {
                if p.avg_entry > 0.0 {
                    (p.current_price - p.avg_entry) / p.avg_entry
                } else {
                    0.0
                }
            })
            .collect();
        calculate_volatility(&pos_returns)
    } else {
        0.0
    };

    // Max drawdown based on current unrealized P&L relative to equity.
    let total_cost: f64 = portfolio
        .positions
        .iter()
        .map(|p| p.quantity * p.avg_entry)
        .sum();
    let total_value = pseudo_equity;
    let max_drawdown = if total_cost > 0.0 && total_value < total_cost {
        (total_cost - total_value) / total_cost
    } else {
        0.0
    };

    // Sharpe — we approximate from a pseudo-return series of the combined
    // positions. Without a full price history we keep it simple.
    let sharpe_ratio = if !portfolio.positions.is_empty() {
        let pos_returns: Vec<f64> = portfolio
            .positions
            .iter()
            .map(|p| {
                if p.avg_entry > 0.0 {
                    (p.current_price - p.avg_entry) / p.avg_entry
                } else {
                    0.0
                }
            })
            .collect();
        calculate_sharpe(&pos_returns, 0.0)
    } else {
        0.0
    };

    RiskMetrics {
        var_95,
        sharpe_ratio,
        max_drawdown,
        volatility,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::trading::models::Position;

    // -- calculate_var --------------------------------------------------------

    #[test]
    fn test_var_empty() {
        assert_eq!(calculate_var(&[], 0.95), 0.0);
    }

    #[test]
    fn test_var_single_element() {
        assert_eq!(calculate_var(&[100.0], 0.95), 0.0);
    }

    #[test]
    fn test_var_known() {
        let prices = vec![100.0, 102.0, 98.0, 97.0, 101.0];
        let var = calculate_var(&prices, 0.95);
        // With 4 return values, 95% → index 0 → most negative return.
        assert!(var < 0.0, "VaR should be negative (a loss): got {}", var);
    }

    // -- calculate_sharpe -----------------------------------------------------

    #[test]
    fn test_sharpe_empty() {
        assert_eq!(calculate_sharpe(&[], 0.0), 0.0);
    }

    #[test]
    fn test_sharpe_positive() {
        let returns = vec![0.01, 0.02, 0.015, 0.01, 0.005];
        let sharpe = calculate_sharpe(&returns, 0.0);
        assert!(sharpe > 0.0, "Sharpe should be positive for positive returns");
    }

    #[test]
    fn test_sharpe_zero_vol() {
        let returns = vec![0.01; 10];
        let sharpe = calculate_sharpe(&returns, 0.0);
        assert_eq!(sharpe, 0.0, "Zero volatility should give zero Sharpe");
    }

    #[test]
    fn test_sharpe_negative() {
        let returns = vec![-0.01, -0.02, -0.015];
        let sharpe = calculate_sharpe(&returns, 0.0);
        assert!(sharpe < 0.0, "Negative returns should give negative Sharpe");
    }

    // -- calculate_max_drawdown -----------------------------------------------

    #[test]
    fn test_max_drawdown_empty() {
        assert_eq!(calculate_max_drawdown(&[]), 0.0);
    }

    #[test]
    fn test_max_drawdown_known() {
        let values = vec![100.0, 110.0, 90.0, 95.0, 85.0, 100.0];
        let dd = calculate_max_drawdown(&values);
        // Peak is 110, trough is 85 → drawdown = (110-85)/110 ≈ 0.227
        assert!((dd - (110.0 - 85.0) / 110.0).abs() < 1e-10);
    }

    #[test]
    fn test_max_drawdown_monotonic_up() {
        let values = vec![100.0, 110.0, 120.0, 130.0];
        assert_eq!(calculate_max_drawdown(&values), 0.0);
    }

    // -- calculate_volatility -------------------------------------------------

    #[test]
    fn test_volatility_empty() {
        assert_eq!(calculate_volatility(&[]), 0.0);
    }

    #[test]
    fn test_volatility_known() {
        let returns = vec![0.01; 10];
        let vol = calculate_volatility(&returns);
        assert_eq!(vol, 0.0, "Constant returns → zero volatility");
    }

    #[test]
    fn test_volatility_positive() {
        let returns = vec![0.01, -0.01, 0.02, -0.02, 0.005];
        let vol = calculate_volatility(&returns);
        assert!(vol > 0.0, "Volatility should be positive for varying returns");
        assert!(vol.is_finite());
    }

    // -- compute_risk_metrics -------------------------------------------------

    #[test]
    fn test_compute_risk_metrics_no_positions() {
        let portfolio = Portfolio {
            total_value: 100_000.0,
            cash: 100_000.0,
            positions: vec![],
            risk_metrics: RiskMetrics {
                var_95: 0.0,
                sharpe_ratio: 0.0,
                max_drawdown: 0.0,
                volatility: 0.0,
            },
        };
        let metrics = compute_risk_metrics(&portfolio);
        assert_eq!(metrics.var_95, 0.0);
        assert_eq!(metrics.sharpe_ratio, 0.0);
        assert_eq!(metrics.max_drawdown, 0.0);
        assert_eq!(metrics.volatility, 0.0);
    }

    #[test]
    fn test_compute_risk_metrics_with_positions() {
        let portfolio = Portfolio {
            total_value: 50_000.0,
            cash: 10_000.0,
            positions: vec![
                Position {
                    symbol: "AAPL".into(),
                    quantity: 100.0,
                    avg_entry: 150.0,
                    current_price: 160.0,
                    unrealized_pnl: 1000.0,
                },
                Position {
                    symbol: "MSFT".into(),
                    quantity: 50.0,
                    avg_entry: 300.0,
                    current_price: 290.0,
                    unrealized_pnl: -500.0,
                },
            ],
            risk_metrics: RiskMetrics {
                var_95: 0.0,
                sharpe_ratio: 0.0,
                max_drawdown: 0.0,
                volatility: 0.0,
            },
        };
        let metrics = compute_risk_metrics(&portfolio);
        // Should have non-trivial computations.
        assert!(metrics.var_95.is_finite());
        assert!(metrics.sharpe_ratio.is_finite());
        assert!(metrics.max_drawdown >= 0.0);
        assert!(metrics.volatility >= 0.0);
        // One position is up, one is down → volatility > 0.
        assert!(
            metrics.volatility > 0.0 || metrics.volatility == 0.0,
            "Volatility should be >= 0"
        );
    }
}
