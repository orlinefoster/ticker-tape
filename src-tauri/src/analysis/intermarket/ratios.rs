//! Key Ratios & Extended Intermarket Analysis
//!
//! Computes intermarket ratios, historical series, normalized returns,
//! and asset correlation matrices from price data.

use std::collections::{BTreeMap, HashMap};
use anyhow::Result;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Trend direction for a ratio or asset
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrendDirection {
    Rising,
    Falling,
    Sideways,
}

impl std::fmt::Display for TrendDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrendDirection::Rising => write!(f, "subiendo"),
            TrendDirection::Falling => write!(f, "bajando"),
            TrendDirection::Sideways => write!(f, "lateral"),
        }
    }
}

/// Computed intermarket key ratios (backwards compatible + extended)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRatios {
    pub stock_bond: f64,
    pub stock_bond_trend: TrendDirection,
    pub cyclical_defensive: f64,
    pub cyclical_defensive_trend: TrendDirection,
    pub commodity_bond: f64,
    pub commodity_bond_trend: TrendDirection,
    pub dollar_ratio: f64,
    pub dollar_trend: TrendDirection,

    // Extended Macro Ratios
    #[serde(default = "default_ratio")]
    pub copper_gold: f64,
    #[serde(default = "default_trend")]
    pub copper_gold_trend: TrendDirection,

    #[serde(default = "default_ratio")]
    pub credit_spread: f64,
    #[serde(default = "default_trend")]
    pub credit_spread_trend: TrendDirection,

    #[serde(default = "default_ratio")]
    pub crypto_gold: f64,
    #[serde(default = "default_trend")]
    pub crypto_gold_trend: TrendDirection,

    #[serde(default = "default_ratio")]
    pub commodity_stock: f64,
    #[serde(default = "default_trend")]
    pub commodity_stock_trend: TrendDirection,

    #[serde(default = "default_ratio")]
    pub inflation_expectation: f64,
    #[serde(default = "default_trend")]
    pub inflation_expectation_trend: TrendDirection,

    #[serde(default = "default_ratio")]
    pub duration_slope: f64,
    #[serde(default = "default_trend")]
    pub duration_slope_trend: TrendDirection,
}

fn default_ratio() -> f64 { 1.0 }
fn default_trend() -> TrendDirection { TrendDirection::Sideways }

/// Individual Macro Ratio Card with historical time series
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroRatioItem {
    pub id: String,
    pub name: String,
    pub pair_label: String,
    pub numerator_symbol: String,
    pub denominator_symbol: String,
    pub current_value: f64,
    pub change_1m_pct: f64,
    pub trend: TrendDirection,
    pub sma20: f64,
    pub sma50: f64,
    pub signal: String, // "bullish" | "bearish" | "neutral"
    pub description: String,
    pub sparkline: Vec<f64>,
    pub history_dates: Vec<String>,
    pub history_values: Vec<f64>,
}

/// Normalized series for multi-asset overlay chart
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedAssetSeries {
    pub symbol: String,
    pub name: String,
    pub color: String,
    pub current_pct: f64,
    pub points: Vec<NormalizedPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedPoint {
    pub date: String,
    pub value: f64, // % change relative to timeframe base
}

/// Intermarket asset correlation matrix
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermarketCorrelation {
    pub symbols: Vec<String>,
    pub labels: Vec<String>,
    pub matrix: Vec<Vec<f64>>,
}

/// Compute all key ratios from simple price vectors (compatibility API)
pub fn compute_key_ratios(price_data: &[(String, Vec<f64>)]) -> Result<KeyRatios> {
    let get_prices = |symbol: &str| -> Option<&[f64]> {
        price_data.iter().find(|(s, _)| s == symbol).map(|(_, p)| p.as_slice())
    };

    // Stock/Bond ratio
    let stock_bond = ratio_of(get_prices("SPY"), get_prices("TLT"));
    let stock_bond_trend = trend_direction(get_prices("SPY"), get_prices("TLT"));

    // Cyclical/Defensive ratio
    let cyclical = avg_ratios(&[
        get_prices("XLF"),
        get_prices("XLI"),
        get_prices("XLY"),
        get_prices("XLK"),
    ]);
    let defensive = avg_ratios(&[
        get_prices("XLV"),
        get_prices("XLP"),
    ]);
    let cyclical_defensive = match (cyclical, defensive) {
        (Some(c), Some(d)) if d > 0.0 => c / d,
        _ => 1.0,
    };
    let cyclical_defensive_trend = trend_direction_from_ratios(
        get_prices("XLF"),
        get_prices("XLP"),
    );

    // Commodity/Bond ratio
    let commodity_bond = ratio_of(get_prices("DBC"), get_prices("TLT"));
    let commodity_bond_trend = trend_direction(get_prices("DBC"), get_prices("TLT"));

    // Dollar
    let dollar_ratio = get_prices("DXY")
        .or_else(|| get_prices("UUP"))
        .and_then(|p| p.last().copied())
        .unwrap_or(100.0);
    let dollar_trend = single_trend(get_prices("DXY").or_else(|| get_prices("UUP")));

    // Copper / Gold (or DBC / GLD)
    let copper_gold = ratio_of(get_prices("CPER").or_else(|| get_prices("DBC")), get_prices("GLD"));
    let copper_gold_trend = trend_direction(get_prices("CPER").or_else(|| get_prices("DBC")), get_prices("GLD"));

    // Credit spread HYG / LQD (or HYG / TLT)
    let credit_spread = ratio_of(get_prices("HYG"), get_prices("LQD").or_else(|| get_prices("TLT")));
    let credit_spread_trend = trend_direction(get_prices("HYG"), get_prices("LQD").or_else(|| get_prices("TLT")));

    // Crypto / Gold
    let crypto_gold = ratio_of(get_prices("BTC"), get_prices("GLD"));
    let crypto_gold_trend = trend_direction(get_prices("BTC"), get_prices("GLD"));

    // Commodity / Stocks
    let commodity_stock = ratio_of(get_prices("DBC"), get_prices("SPY"));
    let commodity_stock_trend = trend_direction(get_prices("DBC"), get_prices("SPY"));

    // Inflation expectations TIP / TLT
    let inflation_expectation = ratio_of(get_prices("TIP").or_else(|| get_prices("DBC")), get_prices("TLT"));
    let inflation_expectation_trend = trend_direction(get_prices("TIP").or_else(|| get_prices("DBC")), get_prices("TLT"));

    // Duration slope TLT / SHY
    let duration_slope = ratio_of(get_prices("TLT"), get_prices("SHY").or_else(|| get_prices("AGG")));
    let duration_slope_trend = trend_direction(get_prices("TLT"), get_prices("SHY").or_else(|| get_prices("AGG")));

    Ok(KeyRatios {
        stock_bond,
        stock_bond_trend,
        cyclical_defensive,
        cyclical_defensive_trend,
        commodity_bond,
        commodity_bond_trend,
        dollar_ratio,
        dollar_trend,
        copper_gold,
        copper_gold_trend,
        credit_spread,
        credit_spread_trend,
        crypto_gold,
        crypto_gold_trend,
        commodity_stock,
        commodity_stock_trend,
        inflation_expectation,
        inflation_expectation_trend,
        duration_slope,
        duration_slope_trend,
    })
}

/// Compute extended intermarket suite with dated alignment, historical ratio series,
/// normalized performance curves, and asset correlation matrix.
pub fn compute_extended_ratios(
    dated_data: &[(String, Vec<(NaiveDate, f64)>)],
) -> Result<(KeyRatios, Vec<MacroRatioItem>, Vec<NormalizedAssetSeries>, IntermarketCorrelation)> {
    // Map of symbol -> BTreeMap<NaiveDate, f64>
    let mut series_map: HashMap<String, BTreeMap<NaiveDate, f64>> = HashMap::new();
    for (sym, bars) in dated_data {
        let mut map = BTreeMap::new();
        for (d, c) in bars {
            map.insert(*d, *c);
        }
        series_map.insert(sym.clone(), map);
    }

    // Convert to plain price vectors for legacy KeyRatios
    let plain_price_data: Vec<(String, Vec<f64>)> = dated_data
        .iter()
        .map(|(s, b)| (s.clone(), b.iter().map(|(_, c)| *c).collect()))
        .collect();

    let key_ratios = compute_key_ratios(&plain_price_data)?;

    // Helper to calculate ratio series aligned by date
    let build_ratio_item = |id: &str,
                            name: &str,
                            sym_num: &str,
                            sym_den: &str,
                            desc: &str,
                            invert_signal: bool|
     -> Option<MacroRatioItem> {
        let num_map = series_map.get(sym_num)?;
        let den_map = series_map.get(sym_den)?;

        let mut common_dates: Vec<NaiveDate> = num_map
            .keys()
            .filter(|d| den_map.contains_key(d))
            .copied()
            .collect();
        common_dates.sort();

        if common_dates.is_empty() {
            return None;
        }

        let mut ratio_vals: Vec<f64> = Vec::with_capacity(common_dates.len());
        let mut date_strs: Vec<String> = Vec::with_capacity(common_dates.len());

        for d in &common_dates {
            let num = num_map.get(d).copied().unwrap_or(1.0);
            let den = den_map.get(d).copied().unwrap_or(1.0);
            let r = if den != 0.0 { num / den } else { 1.0 };
            ratio_vals.push(r);
            date_strs.push(d.to_string());
        }

        let current_value = *ratio_vals.last().unwrap_or(&1.0);
        let sma20 = simple_moving_average(&ratio_vals, 20);
        let sma50 = simple_moving_average(&ratio_vals, 50);

        let change_1m_pct = if ratio_vals.len() > 21 {
            let past = ratio_vals[ratio_vals.len() - 22];
            if past > 0.0 { ((current_value - past) / past) * 100.0 } else { 0.0 }
        } else {
            0.0
        };

        let diff = if sma50 > 0.0 { (sma20 - sma50) / sma50 } else { 0.0 };
        let trend = if diff > 0.01 {
            TrendDirection::Rising
        } else if diff < -0.01 {
            TrendDirection::Falling
        } else {
            TrendDirection::Sideways
        };

        let signal = match (trend, invert_signal) {
            (TrendDirection::Rising, false) | (TrendDirection::Falling, true) => "bullish".to_string(),
            (TrendDirection::Falling, false) | (TrendDirection::Rising, true) => "bearish".to_string(),
            _ => "neutral".to_string(),
        };

        let sparkline_len = ratio_vals.len().min(40);
        let sparkline = ratio_vals[ratio_vals.len() - sparkline_len..].to_vec();

        // History: sample up to 180 points for smooth charting
        let hist_len = ratio_vals.len().min(180);
        let history_values = ratio_vals[ratio_vals.len() - hist_len..].to_vec();
        let history_dates = date_strs[date_strs.len() - hist_len..].to_vec();

        Some(MacroRatioItem {
            id: id.to_string(),
            name: name.to_string(),
            pair_label: format!("{}/{}", sym_num, sym_den),
            numerator_symbol: sym_num.to_string(),
            denominator_symbol: sym_den.to_string(),
            current_value,
            change_1m_pct,
            trend,
            sma20,
            sma50,
            signal,
            description: desc.to_string(),
            sparkline,
            history_dates,
            history_values,
        })
    };

    let mut macro_ratios = Vec::new();

    // 1. Stock / Bond (SPY / TLT)
    if let Some(item) = build_ratio_item(
        "stock_bond",
        "Renta Variable vs Renta Fija (Stock/Bond)",
        "SPY",
        "TLT",
        "Mide la preferencia por riesgo (Equity Risk Premium). Ascendente favorece acciones; descendente favorece refugio en bonos.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 2. Copper / Gold (CPER / GLD or DBC / GLD)
    let (copper_sym, copper_name) = if series_map.contains_key("CPER") {
        ("CPER", "Cobre vs Oro (Copper/Gold)")
    } else {
        ("DBC", "Commodities vs Oro (DBC/GLD)")
    };
    if let Some(item) = build_ratio_item(
        "copper_gold",
        copper_name,
        copper_sym,
        "GLD",
        "Barómetro líder de expansión económica global e impulso industrial frente a aversión al riesgo y refugio monetario.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 3. Credit Risk Spread (HYG / LQD or HYG / TLT)
    let (cred_den, cred_label) = if series_map.contains_key("LQD") {
        ("LQD", "Crédito High Yield vs Investment Grade (HYG/LQD)")
    } else {
        ("TLT", "Crédito Corporativo HY vs Tesoro (HYG/TLT)")
    };
    if let Some(item) = build_ratio_item(
        "credit_spread",
        cred_label,
        "HYG",
        cred_den,
        "Diferencial de riesgo crediticio y liquidez. Un ratio en alza indica compresión de spreads y complacencia de crédito.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 4. Crypto / Gold (BTC / GLD)
    if let Some(item) = build_ratio_item(
        "crypto_gold",
        "Bitcoin vs Oro (Crypto/Gold)",
        "BTC",
        "GLD",
        "Activo de reserva digital de alta beta vs reserva física milenaria. Señaliza apetito especulativo y liquidez monetaria.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 5. Cyclical vs Defensive (XLF/XLP or XLK/XLV)
    let cyc_sym = if series_map.contains_key("XLF") { "XLF" } else { "XLK" };
    let def_sym = if series_map.contains_key("XLP") { "XLP" } else { "XLV" };
    if let Some(item) = build_ratio_item(
        "cyclical_defensive",
        "Sectores Cíclicos vs Defensivos",
        cyc_sym,
        def_sym,
        "Rotación sectorial interna. Fortaleza en cíclicos anticipa crecimiento económico y confianza empresarial.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 6. Commodity / Bond (DBC / TLT)
    if let Some(item) = build_ratio_item(
        "commodity_bond",
        "Materias Primas vs Bonos (DBC/TLT)",
        "DBC",
        "TLT",
        "Sensibilidad al ciclo de inflación y tasas. Alza señala presiones inflacionarias y restricción monetaria.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 7. Commodities vs Stocks (DBC / SPY)
    if let Some(item) = build_ratio_item(
        "commodity_stock",
        "Materias Primas vs Acciones (DBC/SPY)",
        "DBC",
        "SPY",
        "Presión de costos de insumos vs márgenes corporativos. Máximos suelen marcar etapas maduras o estanflacionarias.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // 8. Bitcoin vs S&P 500 (BTC / SPY)
    if let Some(item) = build_ratio_item(
        "crypto_equity",
        "Bitcoin vs S&P 500 (BTC/SPY)",
        "BTC",
        "SPY",
        "Rendimiento excedente de criptoactivos frente al mercado tradicional de acciones norteamericano.",
        false,
    ) {
        macro_ratios.push(item);
    }

    // ── Build Normalized Multi-Asset Overlay Series ──────────────────────
    let asset_configs = [
        ("SPY", "S&P 500 (Acciones)", "#00e676"),
        ("TLT", "Bonos 20Y+ (Treasuries)", "#2979ff"),
        ("DBC", "Commodities (DBC)", "#ff9100"),
        ("GLD", "Oro (GLD)", "#ffd700"),
        ("BTC", "Bitcoin (BTC)", "#f7931a"),
        ("HYG", "Crédito HY (HYG)", "#e040fb"),
    ];

    let mut normalized_series = Vec::new();

    // Determine common available date window for normalized chart
    // Find the latest start date among primary assets to align period
    let primary_symbols = ["SPY", "TLT", "DBC", "GLD"];
    let mut min_dates: Vec<NaiveDate> = Vec::new();
    let mut max_dates: Vec<NaiveDate> = Vec::new();

    for sym in primary_symbols {
        if let Some(bars) = series_map.get(sym) {
            if let Some(first) = bars.keys().next() { min_dates.push(*first); }
            if let Some(last) = bars.keys().next_back() { max_dates.push(*last); }
        }
    }

    let start_cutoff = min_dates.into_iter().max().unwrap_or(NaiveDate::from_ymd_opt(2025, 1, 1).unwrap());
    let end_cutoff = max_dates.into_iter().min().unwrap_or(NaiveDate::from_ymd_opt(2026, 12, 31).unwrap());

    for (sym, name, color) in asset_configs {
        if let Some(bars) = series_map.get(sym) {
            let filtered: Vec<(&NaiveDate, &f64)> = bars
                .iter()
                .filter(|(d, _)| **d >= start_cutoff && **d <= end_cutoff)
                .collect();

            if !filtered.is_empty() {
                let base_val = *filtered[0].1;
                if base_val > 0.0 {
                    let mut points = Vec::with_capacity(filtered.len());
                    for (d, c) in &filtered {
                        let pct = ((**c - base_val) / base_val) * 100.0;
                        points.push(NormalizedPoint {
                            date: d.to_string(),
                            value: (pct * 100.0).round() / 100.0,
                        });
                    }
                    let current_pct = points.last().map(|p| p.value).unwrap_or(0.0);
                    normalized_series.push(NormalizedAssetSeries {
                        symbol: sym.to_string(),
                        name: name.to_string(),
                        color: color.to_string(),
                        current_pct,
                        points,
                    });
                }
            }
        }
    }

    // ── Build Intermarket Correlation Matrix ────────────────────────────
    let corr_targets = [
        ("SPY", "Acciones (SPY)"),
        ("TLT", "Bonos (TLT)"),
        ("DBC", "Commodities"),
        ("GLD", "Oro (GLD)"),
        ("BTC", "Bitcoin"),
        ("HYG", "Crédito HY"),
    ];

    let mut corr_symbols = Vec::new();
    let mut corr_labels = Vec::new();
    let mut return_series: Vec<Vec<f64>> = Vec::new();

    // Collect daily returns for each asset on common dates
    let mut all_common_dates: Vec<NaiveDate> = Vec::new();
    let mut first_sym = true;

    for (sym, _) in corr_targets {
        if let Some(bars) = series_map.get(sym) {
            let keys: Vec<NaiveDate> = bars.keys().copied().collect();
            if first_sym {
                all_common_dates = keys;
                first_sym = false;
            } else {
                all_common_dates.retain(|d| bars.contains_key(d));
            }
        }
    }
    all_common_dates.sort();

    // Use last 60 common trading days for correlation
    let window_dates = if all_common_dates.len() > 60 {
        &all_common_dates[all_common_dates.len() - 60..]
    } else {
        &all_common_dates[..]
    };

    for (sym, label) in corr_targets {
        if let Some(bars) = series_map.get(sym) {
            let prices: Vec<f64> = window_dates
                .iter()
                .filter_map(|d| bars.get(d).copied())
                .collect();

            if prices.len() >= 10 {
                let mut returns = Vec::with_capacity(prices.len().saturating_sub(1));
                for i in 1..prices.len() {
                    let prev = prices[i - 1];
                    let curr = prices[i];
                    if prev > 0.0 {
                        returns.push((curr - prev) / prev);
                    } else {
                        returns.push(0.0);
                    }
                }
                corr_symbols.push(sym.to_string());
                corr_labels.push(label.to_string());
                return_series.push(returns);
            }
        }
    }

    let n = corr_symbols.len();
    let mut matrix = vec![vec![1.0; n]; n];

    for i in 0..n {
        for j in 0..n {
            if i == j {
                matrix[i][j] = 1.0;
            } else if j > i {
                let r = pearson_correlation(&return_series[i], &return_series[j]);
                matrix[i][j] = (r * 100.0).round() / 100.0;
                matrix[j][i] = matrix[i][j];
            }
        }
    }

    let correlation_matrix = IntermarketCorrelation {
        symbols: corr_symbols,
        labels: corr_labels,
        matrix,
    };

    Ok((key_ratios, macro_ratios, normalized_series, correlation_matrix))
}

// ── Math helpers ─────────────────────────────────────────────────────────

fn pearson_correlation(x: &[f64], y: &[f64]) -> f64 {
    let n = x.len().min(y.len());
    if n < 5 {
        return 0.0;
    }
    let mean_x = x[..n].iter().sum::<f64>() / n as f64;
    let mean_y = y[..n].iter().sum::<f64>() / n as f64;

    let mut num = 0.0;
    let mut denom_x = 0.0;
    let mut denom_y = 0.0;

    for i in 0..n {
        let dx = x[i] - mean_x;
        let dy = y[i] - mean_y;
        num += dx * dy;
        denom_x += dx * dx;
        denom_y += dy * dy;
    }

    let denom = (denom_x * denom_y).sqrt();
    if denom == 0.0 {
        0.0
    } else {
        (num / denom).clamp(-1.0, 1.0)
    }
}

/// Compute ratio of two price series (latest values)
fn ratio_of(a: Option<&[f64]>, b: Option<&[f64]>) -> f64 {
    match (a, b) {
        (Some(a), Some(b)) => {
            let last_a = a.last().copied().unwrap_or(1.0);
            let last_b = b.last().copied().unwrap_or(1.0);
            if last_b != 0.0 { last_a / last_b } else { 1.0 }
        }
        _ => 1.0,
    }
}

/// Average ratio of multiple series
fn avg_ratios(series: &[Option<&[f64]>]) -> Option<f64> {
    let values: Vec<f64> = series.iter()
        .filter_map(|s| s.and_then(|p| p.last().copied()))
        .collect();
    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<f64>() / values.len() as f64)
    }
}

/// Trend direction comparing two series
fn trend_direction(prices_a: Option<&[f64]>, prices_b: Option<&[f64]>) -> TrendDirection {
    match (prices_a, prices_b) {
        (Some(a), Some(b)) => {
            let min_len = a.len().min(b.len());
            if min_len < 20 {
                return TrendDirection::Sideways;
            }
            // Align from end
            let a_tail = &a[a.len() - min_len..];
            let b_tail = &b[b.len() - min_len..];
            let ratio: Vec<f64> = a_tail.iter().zip(b_tail.iter())
                .map(|(x, y)| if *y != 0.0 { x / y } else { 0.0 })
                .collect();
            single_trend(Some(&ratio))
        }
        _ => TrendDirection::Sideways,
    }
}

/// Trend direction comparing cyclical vs defensive
fn trend_direction_from_ratios(
    cyclical_prices: Option<&[f64]>,
    defensive_prices: Option<&[f64]>,
) -> TrendDirection {
    trend_direction(cyclical_prices, defensive_prices)
}

/// Determine trend from a single price series using SMA crossover
pub fn single_trend(prices: Option<&[f64]>) -> TrendDirection {
    match prices {
        Some(p) if p.len() >= 20 => {
            let fast_len = 10.min(p.len());
            let slow_len = 30.min(p.len());
            let fast_sma = simple_moving_average(p, fast_len);
            let slow_sma = simple_moving_average(p, slow_len);
            let threshold = 0.005; // 0.5% threshold

            let diff = if slow_sma > 0.0 { (fast_sma - slow_sma) / slow_sma } else { 0.0 };
            if diff > threshold {
                TrendDirection::Rising
            } else if diff < -threshold {
                TrendDirection::Falling
            } else {
                TrendDirection::Sideways
            }
        }
        _ => TrendDirection::Sideways,
    }
}

pub fn simple_moving_average(data: &[f64], period: usize) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    if data.len() < period {
        return data.iter().copied().sum::<f64>() / data.len() as f64;
    }
    let start = data.len() - period;
    let sum: f64 = data[start..].iter().copied().sum();
    sum / period as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rising_prices() -> Vec<f64> {
        (0..100).map(|i| 100.0 + i as f64 * 0.5).collect()
    }

    fn falling_prices() -> Vec<f64> {
        (0..100).map(|i| 200.0 - i as f64 * 0.5).collect()
    }

    #[test]
    fn test_single_trend_rising() {
        assert!(matches!(single_trend(Some(&rising_prices())), TrendDirection::Rising));
    }

    #[test]
    fn test_single_trend_falling() {
        assert!(matches!(single_trend(Some(&falling_prices())), TrendDirection::Falling));
    }

    #[test]
    fn test_single_trend_insufficient_data() {
        let short = vec![100.0];
        assert!(matches!(single_trend(Some(&short)), TrendDirection::Sideways));
    }

    #[test]
    fn test_ratio_of() {
        let a = vec![100.0, 110.0, 120.0];
        let b = vec![100.0, 100.0, 100.0];
        assert!((ratio_of(Some(&a), Some(&b)) - 1.2).abs() < 0.001);
    }

    #[test]
    fn test_ratio_of_zero_divisor() {
        let a = vec![100.0];
        let b = vec![0.0];
        assert!((ratio_of(Some(&a), Some(&b)) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_key_ratios_defaults_on_empty() {
        let data = vec![];
        let result = compute_key_ratios(&data).unwrap();
        assert!((result.stock_bond - 1.0).abs() < 0.001);
        assert!(matches!(result.stock_bond_trend, TrendDirection::Sideways));
    }

    #[test]
    fn test_pearson_correlation() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let r = pearson_correlation(&a, &b);
        assert!((r - 1.0).abs() < 0.001);

        let c = vec![10.0, 8.0, 6.0, 4.0, 2.0];
        let r_inv = pearson_correlation(&a, &c);
        assert!((r_inv - (-1.0)).abs() < 0.001);
    }
}
