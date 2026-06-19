//! Backtesting engine
//!
//! Walks through historical bars in chronological order, evaluates a
//! strategy at each step, and tracks trades, equity, and risk metrics.

use chrono::NaiveDate;
use serde::Serialize;

use crate::trading::bar_collection::BarCollection;
use crate::trading::models::SignalDirection;
use crate::trading::strategies::Strategy;
use crate::trading::risk;

/// Result of a single backtest run.
#[derive(Debug, Clone, Serialize)]
pub struct BacktestResult {
    /// Total return as a decimal (e.g. 0.15 = 15%).
    pub total_return: f64,
    /// Annualised return (geometric) as a decimal.
    pub annualized_return: f64,
    /// Annualised Sharpe ratio (risk-free = 0).
    pub sharpe: f64,
    /// Maximum peak-to-trough drawdown as a decimal.
    pub max_drawdown: f64,
    /// Fraction of profitable trades (0.0 .. 1.0).
    pub win_rate: f64,
    /// Total number of completed trades (entry/exit pairs).
    pub num_trades: usize,
    /// Portfolio equity after each bar (mark-to-market).
    pub equity_curve: Vec<f64>,
}

/// A single completed trade (entry → exit).
#[derive(Debug, Clone)]
pub struct TradeRecord {
    pub entry_date: NaiveDate,
    pub exit_date: NaiveDate,
    pub entry_price: f64,
    pub exit_price: f64,
    pub quantity: f64,
    pub pnl: f64,
    pub pnl_pct: f64,
}

/// Backtesting engine.
///
/// Walks through bars chronologically, evaluates a strategy at each step,
/// and produces performance metrics.
pub struct Backtester {
    pub initial_capital: f64,
    /// Fraction of current capital allocated per trade (default 0.02 = 2%).
    pub risk_per_trade: f64,
}

impl Backtester {
    /// Create a new backtester with the given starting capital.
    pub fn new(initial_capital: f64) -> Self {
        Self {
            initial_capital,
            risk_per_trade: 0.02,
        }
    }

    /// Run a backtest.
    ///
    /// 1. The strategy is evaluated once against all bars.
    /// 2. Bars are iterated in chronological order (already guaranteed by
    ///    `BarCollection`).
    /// 3. At each bar, matching signals are checked:
    ///    - Buy signal + not in position → enter (buy at close).
    ///    - Sell signal + in position → exit (sell at close).
    /// 4. Position size = `risk_per_trade` × current capital.
    pub async fn run(&self, strategy: &dyn Strategy, bars: &BarCollection) -> BacktestResult {
        // Determine symbol from the first bar.
        let symbol = bars
            .first()
            .map(|b| b.symbol.as_str())
            .unwrap_or("UNKNOWN");

        // Evaluate the strategy once for the entire series.
        let all_signals = strategy.evaluate(symbol, bars).await;

        // Index signals by date for O(1) lookups during iteration.
        let mut signal_map: std::collections::HashMap<NaiveDate, (f64, f64)> =
            std::collections::HashMap::new();
        for sig in &all_signals {
            let date = sig.timestamp.date_naive();
            let entry = signal_map.entry(date).or_insert((0.0, 0.0));
            match sig.direction {
                SignalDirection::Buy => entry.0 += sig.strength,
                SignalDirection::Sell => entry.1 += sig.strength,
                SignalDirection::Neutral => {}
            }
        }

        // --- Walk through bars ------------------------------------------------
        let mut cash = self.initial_capital;
        let mut position: f64 = 0.0; // shares held
        let mut entry_price: f64 = 0.0;
        let mut entry_date: Option<NaiveDate> = None;

        let mut trades: Vec<TradeRecord> = Vec::new();
        let mut equity_curve: Vec<f64> = Vec::with_capacity(bars.len());

        for bar in bars.iter() {
            let equity = cash + position * bar.close;
            equity_curve.push(equity);

            if let Some(&(buy_strength, sell_strength)) = signal_map.get(&bar.date) {
                if buy_strength > sell_strength && position < f64::EPSILON {
                    // --- Enter long -------------------------------------------
                    let allocated = cash * self.risk_per_trade;
                    if allocated > 0.0 {
                        position = allocated / bar.close;
                        entry_price = bar.close;
                        entry_date = Some(bar.date);
                        cash -= allocated;
                    }
                } else if sell_strength > buy_strength && position > 0.0 {
                    // --- Exit long --------------------------------------------
                    let exit_value = position * bar.close;
                    let pnl = exit_value - (position * entry_price);
                    let pnl_pct = if entry_price > 0.0 {
                        (bar.close - entry_price) / entry_price
                    } else {
                        0.0
                    };

                    trades.push(TradeRecord {
                        entry_date: entry_date.unwrap(), // safe: we're in position
                        exit_date: bar.date,
                        entry_price,
                        exit_price: bar.close,
                        quantity: position,
                        pnl,
                        pnl_pct,
                    });

                    cash += exit_value;
                    position = 0.0;
                }
            }
        }

        // --- Liquidate any open position at the last bar ----------------------
        if position > 0.0 {
            if let Some(last) = bars.last() {
                let exit_value = position * last.close;
                let pnl = exit_value - (position * entry_price);
                trades.push(TradeRecord {
                    entry_date: entry_date.unwrap(), // safe: we're in position
                    exit_date: last.date,
                    entry_price,
                    exit_price: last.close,
                    quantity: position,
                    pnl,
                    pnl_pct: if entry_price > 0.0 {
                        (last.close - entry_price) / entry_price
                    } else {
                        0.0
                    },
                });
                cash += exit_value;
                // position is intentionally NOT cleared here — it's dropped anyway
            }
        }

        // Final equity after liquidation
        let final_equity = cash;
        equity_curve.push(final_equity);

        // --- Compute metrics --------------------------------------------------
        let total_return = if self.initial_capital > 0.0 {
            (final_equity - self.initial_capital) / self.initial_capital
        } else {
            0.0
        };

        let n_bars = bars.len();
        let annualized_return = if n_bars > 0 && total_return > -1.0 {
            (1.0 + total_return).powf(252.0 / n_bars as f64) - 1.0
        } else {
            0.0
        };

        // Compute daily returns from equity curve for Sharpe.
        let daily_returns: Vec<f64> = equity_curve
            .windows(2)
            .map(|w| (w[1] - w[0]) / w[0])
            .filter(|&r| r.is_finite())
            .collect();

        let sharpe = risk::calculate_sharpe(&daily_returns, 0.0);
        let max_drawdown = risk::calculate_max_drawdown(&equity_curve);

        let num_trades = trades.len();
        let win_rate = if num_trades > 0 {
            trades.iter().filter(|t| t.pnl > 0.0).count() as f64 / num_trades as f64
        } else {
            0.0
        };

        BacktestResult {
            total_return,
            annualized_return,
            sharpe,
            max_drawdown,
            win_rate,
            num_trades,
            equity_curve,
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use crate::trading::backtest::Backtester;
    use crate::trading::bar_collection::BarCollection;
    use crate::trading::models::OHLCVBar;
    use crate::trading::strategies::{BollingerBands, RSI};

    fn make_bar(date: NaiveDate, close: f64) -> OHLCVBar {
        OHLCVBar {
            symbol: "TEST".into(),
            date,
            open: close,
            high: close,
            low: close,
            close,
            volume: 1000.0,
        }
    }

    fn make_collection(closes: &[f64]) -> BarCollection {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let bars: Vec<_> = closes
            .iter()
            .enumerate()
            .map(|(i, &c)| {
                make_bar(
                    start + chrono::Duration::days(i as i64),
                    c,
                )
            })
            .collect();
        BarCollection::new(bars).unwrap()
    }

    #[tokio::test]
    async fn test_backtest_with_bb() {
        // Create a clear dip pattern that BB should catch.
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 10]); // dip
        closes.extend((0..10).map(|i| 80.0 + i as f64 * 2.0)); // recovery

        let bars = make_collection(&closes);
        let bb = BollingerBands::new(20, 2.0);
        let bt = Backtester::new(100_000.0);
        let result = bt.run(&bb, &bars).await;

        // Should have completed at least one trade.
        assert!(
            result.num_trades > 0,
            "Expected at least one trade: got {}",
            result.num_trades
        );
        // Equity curve should have entries.
        assert!(
            result.equity_curve.len() >= bars.len(),
            "Equity curve too short: {}",
            result.equity_curve.len()
        );
        // Total return should be finite.
        assert!(result.total_return.is_finite());
        // Max drawdown should be >= 0.
        assert!(result.max_drawdown >= 0.0);
    }

    #[tokio::test]
    async fn test_backtest_no_signals() {
        // Flat prices → no signals → no trades.
        let bars = make_collection(&[100.0; 60]);
        let bt = Backtester::new(100_000.0);
        let rsi = RSI::new(14, 70.0, 30.0);
        let result = bt.run(&rsi, &bars).await;

        assert_eq!(result.num_trades, 0);
        assert!((result.total_return).abs() < 1e-10);
        assert_eq!(result.win_rate, 0.0);
    }

    #[tokio::test]
    async fn test_backtest_initial_capital_preserved() {
        let bars = make_collection(&[100.0; 30]);
        let bb = BollingerBands::new(20, 2.0);
        let bt = Backtester::new(50_000.0);
        let result = bt.run(&bb, &bars).await;

        // Flat market, no signals → capital unchanged.
        assert_eq!(result.num_trades, 0);
        assert!((result.total_return).abs() < 1e-10);
    }

    #[tokio::test]
    async fn test_backtest_equity_curve_length() {
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 10]);
        closes.extend((0..10).map(|i| 80.0 + i as f64 * 2.0));

        let bars = make_collection(&closes);
        let bb = BollingerBands::new(20, 2.0);
        let bt = Backtester::new(100_000.0);
        let result = bt.run(&bb, &bars).await;

        // Equity curve: one entry per bar + one final (post-liquidation).
        assert_eq!(result.equity_curve.len(), bars.len() + 1);
    }

    #[tokio::test]
    async fn test_backtest_sharpe_finite() {
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 10]);
        closes.extend((0..10).map(|i| 80.0 + i as f64 * 2.0));

        let bars = make_collection(&closes);
        let bb = BollingerBands::new(20, 2.0);
        let bt = Backtester::new(100_000.0);
        let result = bt.run(&bb, &bars).await;

        assert!(result.sharpe.is_finite(), "Sharpe should be finite");
    }

    #[tokio::test]
    async fn test_backtest_risk_per_trade() {
        let mut closes: Vec<f64> = (0..25).map(|_| 100.0).collect();
        closes.extend(&[80.0; 10]);

        let bars = make_collection(&closes);
        let bb = BollingerBands::new(20, 2.0);

        // Lower risk per trade → smaller position → smaller PnL impact.
        let bt_low = Backtester {
            initial_capital: 100_000.0,
            risk_per_trade: 0.01,
        };
        let bt_high = Backtester {
            initial_capital: 100_000.0,
            risk_per_trade: 0.10,
        };

        let result_low = bt_low.run(&bb, &bars).await;
        let result_high = bt_high.run(&bb, &bars).await;

        // Both should have the same number of trades.
        assert_eq!(result_low.num_trades, result_high.num_trades);
    }

    #[test]
    fn test_backtester_default_risk() {
        let bt = Backtester::new(100_000.0);
        assert!((bt.risk_per_trade - 0.02).abs() < 1e-10);
    }
}
