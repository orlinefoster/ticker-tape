//! Cycle Phase & John Murphy 6-Stage Detection
//!
//! Determines the economic cycle phase using John Murphy's classic 6-Stage
//! Intermarket Model (Bonds -> Stocks -> Commodities sequencing) and generates
//! Tactical Asset Allocation (TAA) recommendations.

use serde::{Deserialize, Serialize};
use super::ratios::{KeyRatios, TrendDirection};

/// Market cycle phases (high level macro category)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarketPhase {
    /// Stocks rising, bonds falling, commodities stable -> improving fundamentals
    EarlyExpansion,
    /// Stocks still up, commodities surging, bonds falling -> late cycle
    LateExpansion,
    /// Stocks volatile/peaking, bonds start rising, commodities at highs
    Peak,
    /// Stocks falling, bonds rallying, commodities crashing
    Contraction,
    /// Everything bottoming, bonds still strong, value emerging
    Trough,
}

impl MarketPhase {
    pub fn label(&self) -> &str {
        match self {
            MarketPhase::EarlyExpansion => "Expansión Temprana",
            MarketPhase::LateExpansion => "Expansión Tardía",
            MarketPhase::Peak => "Pico de Ciclo",
            MarketPhase::Contraction => "Contracción",
            MarketPhase::Trough => "Fondo de Ciclo",
        }
    }

    pub fn emoji(&self) -> &str {
        match self {
            MarketPhase::EarlyExpansion => "🌱",
            MarketPhase::LateExpansion => "🌊",
            MarketPhase::Peak => "⛰️",
            MarketPhase::Contraction => "📉",
            MarketPhase::Trough => "🪨",
        }
    }
}

/// Score for each of the 6 John Murphy stages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageScore {
    pub stage: u8,
    pub name: String,
    pub score: f64, // 0.0 to 1.0 (alignment percentage)
    pub description: String,
}

/// Leading and lagging asset status in the intermarket sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeadingLaggingStatus {
    pub bonds_status: String,
    pub stocks_status: String,
    pub commodities_status: String,
    pub dollar_status: String,
    pub summary: String,
}

/// Tactical Asset Allocation recommendation based on Murphy Stage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TacticalAssetAllocation {
    pub asset_class: String,
    pub stance: String,       // "overweight" | "neutral" | "underweight"
    pub stance_label: String, // "Sobreponderar" | "Neutral" | "Subponderar"
    pub weight_delta_pct: f64,
    pub rationale: String,
    pub top_picks: Vec<String>,
    pub avoid: Vec<String>,
}

/// Historical or projected cycle band for timeline charts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalCycleBand {
    pub start_date: String,
    pub end_date: String,
    pub stage: u8,
    pub stage_name: String,
    pub color: String,
}

/// Comprehensive cycle analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MurphyCycleResult {
    pub phase: MarketPhase,
    pub stage: u8,
    pub stage_name: String,
    pub stage_description: String,
    pub confidence: f64,
    pub stage_scores: Vec<StageScore>,
    pub leaders: LeadingLaggingStatus,
    pub tactical_allocation: Vec<TacticalAssetAllocation>,
    pub indicators: Vec<super::IndicatorResult>,
}

/// Detect the John Murphy stage and macro cycle phase
#[allow(unused_variables)]
pub fn detect_murphy_cycle(
    price_data: &[(String, Vec<f64>)],
    ratios: &KeyRatios,
) -> MurphyCycleResult {
    let mut indicators = Vec::new();

    // 1. Stock / Bond Ratio
    let sb_score = score_from_trend(ratios.stock_bond_trend);
    indicators.push(super::IndicatorResult {
        name: "Stock / Bond Ratio (SPY/TLT)".into(),
        value: ratios.stock_bond,
        signal: signal_from_score(sb_score),
        weight: 1.0,
        description: format!("Tendencia SPY/TLT: {}. Apetito por renta variable vs renta fija.", ratios.stock_bond_trend),
    });

    // 2. Cyclical / Defensive
    let cd_score = score_from_trend(ratios.cyclical_defensive_trend);
    indicators.push(super::IndicatorResult {
        name: "Sectores Cíclicos vs Defensivos".into(),
        value: ratios.cyclical_defensive,
        signal: signal_from_score(cd_score),
        weight: 0.9,
        description: format!("Rotación sectorial: {}. Acompañamiento del ciclo económico.", ratios.cyclical_defensive_trend),
    });

    // 3. Commodity / Bond
    let cb_score = score_from_trend(ratios.commodity_bond_trend);
    indicators.push(super::IndicatorResult {
        name: "Commodity / Bond (DBC/TLT)".into(),
        value: ratios.commodity_bond,
        signal: signal_from_score(cb_score),
        weight: 0.85,
        description: "Presión inflacionaria de insumos frente a bonos soberanos refugio.".into(),
    });

    // 4. Copper / Gold (or DBC / GLD)
    let cg_score = score_from_trend(ratios.copper_gold_trend);
    indicators.push(super::IndicatorResult {
        name: "Copper / Gold Ratio (Crecimiento Global)".into(),
        value: ratios.copper_gold,
        signal: signal_from_score(cg_score),
        weight: 0.85,
        description: "Barómetro de demanda manufacturera mundial vs aversión al riesgo.".into(),
    });

    // 5. Credit Spread (HYG / LQD or HYG / TLT)
    let cs_score = score_from_trend(ratios.credit_spread_trend);
    indicators.push(super::IndicatorResult {
        name: "Diferencial de Crédito (HYG/LQD)".into(),
        value: ratios.credit_spread,
        signal: signal_from_score(cs_score),
        weight: 0.8,
        description: "Salud del mercado de crédito corporativo y liquidez bancaria.".into(),
    });

    // 6. Dollar Trend
    let dxy_score = match ratios.dollar_trend {
        TrendDirection::Rising => -0.5,
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => 0.6,
    };
    indicators.push(super::IndicatorResult {
        name: "Tendencia del Dólar (DXY/UUP)".into(),
        value: ratios.dollar_ratio,
        signal: signal_from_score(dxy_score),
        weight: 0.65,
        description: format!("Dólar: {}. Efecto sobre liquidez global y mercados emergentes.", ratios.dollar_trend),
    });

    // 7. Crypto / Gold
    let btc_score = score_from_trend(ratios.crypto_gold_trend);
    indicators.push(super::IndicatorResult {
        name: "Crypto / Gold (BTC/GLD)".into(),
        value: ratios.crypto_gold,
        signal: signal_from_score(btc_score),
        weight: 0.6,
        description: "Preferencia por activos de alta beta digital vs reserva de valor tradicional.".into(),
    });

    // ── Evaluate John Murphy's 6 Stages ─────────────────────────────────
    // Vector: [Stock/Bond, Cyclical/Defensive, Commodity/Bond, Copper/Gold, CreditSpread, DollarTailwind]
    let actual = [sb_score, cd_score, cb_score, cg_score, cs_score, dxy_score];
    let weights = [1.0, 0.9, 0.85, 0.85, 0.8, 0.65];
    let total_weight: f64 = weights.iter().sum();

    // Profiles for John Murphy's 6 stages:
    // Stage 1: Bonds UP, Stocks BOTTOMING/NEUTRAL, Commodities DOWN
    // Stage 2: Bonds UP, Stocks UP, Commodities DOWN
    // Stage 3: Bonds DOWN, Stocks UP, Commodities UP
    // Stage 4: Bonds DOWN, Stocks DOWN/PEAKING, Commodities UP
    // Stage 5: Bonds DOWN, Stocks DOWN, Commodities DOWN
    // Stage 6: Bonds UP (Turning), Stocks DOWN, Commodities DOWN
    let stage_profiles: [(u8, &str, &str, MarketPhase, [f64; 6]); 6] = [
        (
            1,
            "Etapa 1: Fondo de Bonos & Recuperación Inicial",
            "Los bonos soberanos suben liderando el giro macro; acciones tocan suelo y materias primas permanecen deprimidas.",
            MarketPhase::Trough,
            [-0.2, -0.4, -0.7, -0.3, 0.3, 0.3],
        ),
        (
            2,
            "Etapa 2: Giro de Acciones & Despegue Bull Market",
            "Bonos continúan firmes y las acciones inician su gran ciclo alcista; inflación contenida con materias primas aún bajas.",
            MarketPhase::EarlyExpansion,
            [0.8, 0.7, -0.3, 0.6, 0.8, 0.5],
        ),
        (
            3,
            "Etapa 3: Expansión Plena & Auge de Commodities",
            "Auge económico; acciones continúan en alza y las materias primas despegan con fuerza; bonos comienzan a ceder por suba de tasas.",
            MarketPhase::LateExpansion,
            [0.6, 0.5, 0.8, 0.8, 0.6, -0.2],
        ),
        (
            4,
            "Etapa 4: Techo de Mercado & Presión Inflacionaria",
            "Inflación y commodities en máximos de ciclo; bonos caen fuertemente y las acciones comienzan a corregir por tasas restrictivas.",
            MarketPhase::Peak,
            [-0.4, -0.5, 0.8, 0.2, -0.4, -0.5],
        ),
        (
            5,
            "Etapa 5: Contracción de Activos & Crisis de Liquidez",
            "Fase de ajuste generalizado; caen acciones y materias primas; el efectivo y el dólar se consolidan como activos refugio.",
            MarketPhase::Contraction,
            [-0.8, -0.8, -0.6, -0.8, -0.8, 0.4],
        ),
        (
            6,
            "Etapa 6: Recesión & Giro Defensivo de Bonos",
            "Recesión evidente; los bancos centrales flexibilizan la política monetaria; los bonos inician un fuerte rally de recuperación.",
            MarketPhase::Trough,
            [0.2, -0.7, -0.8, -0.6, -0.3, -0.2],
        ),
    ];

    let mut stage_scores = Vec::with_capacity(6);
    let mut best_stage = 2;
    let mut best_name = stage_profiles[1].1.to_string();
    let mut best_desc = stage_profiles[1].2.to_string();
    let mut best_phase = MarketPhase::EarlyExpansion;
    let mut highest_score = f64::NEG_INFINITY;

    for (stage_num, name, desc, phase, profile) in &stage_profiles {
        let mut dot = 0.0;
        for i in 0..6 {
            dot += weights[i] * actual[i] * profile[i];
        }
        let normalized = ((dot / total_weight) + 1.0) / 2.0;
        let score_val = normalized.clamp(0.05, 0.99);

        stage_scores.push(StageScore {
            stage: *stage_num,
            name: name.to_string(),
            score: (score_val * 100.0).round() / 100.0,
            description: desc.to_string(),
        });

        if dot > highest_score {
            highest_score = dot;
            best_stage = *stage_num;
            best_name = name.to_string();
            best_desc = desc.to_string();
            best_phase = *phase;
        }
    }

    let confidence = (((highest_score / total_weight) + 1.0) / 2.0).clamp(0.3, 0.98);

    // ── Leading and Lagging Asset Status ────────────────────────────────
    let leaders = determine_leaders(best_stage, ratios);

    // ── Tactical Asset Allocation ───────────────────────────────────────
    let tactical_allocation = build_tactical_allocation(best_stage);

    MurphyCycleResult {
        phase: best_phase,
        stage: best_stage,
        stage_name: best_name,
        stage_description: best_desc,
        confidence,
        stage_scores,
        leaders,
        tactical_allocation,
        indicators,
    }
}

/// Legacy wrapper for backwards compatibility
pub fn detect_phase(
    price_data: &[(String, Vec<f64>)],
    ratios: &KeyRatios,
) -> (MarketPhase, f64, Vec<super::IndicatorResult>) {
    let res = detect_murphy_cycle(price_data, ratios);
    (res.phase, res.confidence, res.indicators)
}

fn score_from_trend(trend: TrendDirection) -> f64 {
    match trend {
        TrendDirection::Rising => 0.8,
        TrendDirection::Sideways => 0.0,
        TrendDirection::Falling => -0.8,
    }
}

fn signal_from_score(score: f64) -> String {
    if score > 0.2 {
        "bullish".to_string()
    } else if score < -0.2 {
        "bearish".to_string()
    } else {
        "neutral".to_string()
    }
}

fn determine_leaders(stage: u8, _ratios: &KeyRatios) -> LeadingLaggingStatus {
    match stage {
        1 => LeadingLaggingStatus {
            bonds_status: "Liderando Giro Alcista".into(),
            stocks_status: "Buscando Suelo / Rezagadas".into(),
            commodities_status: "En Mínimos Cíclicos".into(),
            dollar_status: "Techo / Neutral".into(),
            summary: "Los bonos soberanos están liderando la recuperación del mercado tras el ciclo bajista.".into(),
        },
        2 => LeadingLaggingStatus {
            bonds_status: "Consolidación Fuerte".into(),
            stocks_status: "Liderando Momentum Alcista".into(),
            commodities_status: "Comenzando a Estabilizar".into(),
            dollar_status: "Debilitándose / Tailwind".into(),
            summary: "La renta variable lidera con solidez el inicio del nuevo ciclo económico expansivo.".into(),
        },
        3 => LeadingLaggingStatus {
            bonds_status: "Giro Bajista por Tasas".into(),
            stocks_status: "Impulso Alcista Continuado".into(),
            commodities_status: "Liderando con Aceleración".into(),
            dollar_status: "Presión Mixta".into(),
            summary: "Las materias primas aceleran liderando el auge económico, mientras los bonos ceden terreno.".into(),
        },
        4 => LeadingLaggingStatus {
            bonds_status: "Tendencia Bajista Madura".into(),
            stocks_status: "Techo / Distribución".into(),
            commodities_status: "Pico Inflacionario Tardío".into(),
            dollar_status: "Fortaleciéndose".into(),
            summary: "Las materias primas alcanzan máximos mientras las acciones muestran señales de agotamiento.".into(),
        },
        5 => LeadingLaggingStatus {
            bonds_status: "Buscando Suelo".into(),
            stocks_status: "Tendencia Bajista Activa".into(),
            commodities_status: "Giro Bajista Confirmado".into(),
            dollar_status: "Liderando como Refugio".into(),
            summary: "El dólar y el efectivo actúan como líderes de refugio ante la contracción generalizada de activos.".into(),
        },
        _ => LeadingLaggingStatus {
            bonds_status: "Liderando Rebote por Tasas Bajas".into(),
            stocks_status: "Fase Final de Corrección".into(),
            commodities_status: "Deprimidas".into(),
            dollar_status: "Debilidad Incipiente".into(),
            summary: "Los bonos soberanos anticipan el fin de la recesión gracias a la flexibilización de los bancos centrales.".into(),
        },
    }
}

fn build_tactical_allocation(stage: u8) -> Vec<TacticalAssetAllocation> {
    match stage {
        1 => vec![
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 20.0,
                rationale: "Los bonos de largo plazo son el primer activo en tocar suelo y ofrecer rally de duración.".into(),
                top_picks: vec!["TLT".into(), "IEF".into(), "AGG".into()],
                avoid: vec!["DBC".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Acumulando".into(),
                weight_delta_pct: 5.0,
                rationale: "Las acciones están en proceso de formar suelo; acumular sectores de calidad y dividendo.".into(),
                top_picks: vec!["SPY".into(), "XLV".into(), "XLF".into()],
                avoid: vec!["XLE".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Materias Primas (Commodities)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "La demanda industrial aún sigue deprimida en la etapa inicial de recuperación.".into(),
                top_picks: vec!["GLD".into()],
                avoid: vec!["DBC".into(), "CPER".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "neutral".into(),
                stance_label: "Neutral".into(),
                weight_delta_pct: 0.0,
                rationale: "Mantener liquidez para desplegar en oportunidades a medida que se confirma el suelo.".into(),
                top_picks: vec!["BIL".into(), "SHY".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / DCA".into(),
                weight_delta_pct: 0.0,
                rationale: "Fase de consolidación y formación de base histórica tras el criptoinvierno.".into(),
                top_picks: vec!["BTC".into()],
                avoid: vec!["Altcoins alta beta".into()],
            },
        ],
        2 => vec![
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 25.0,
                rationale: "Fase óptima de expansión: crecimiento de utilidades corporativas y expansión de múltiplos.".into(),
                top_picks: vec!["QQQ".into(), "XLK".into(), "XLY".into(), "SPY".into()],
                avoid: vec!["XLP".into(), "XLU".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 10.0,
                rationale: "Los bonos mantienen estabilidad y devengan cupón positivo sin presiones de inflación.".into(),
                top_picks: vec!["TLT".into(), "HYG".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 15.0,
                rationale: "El apetito por riesgo y la expansión de liquidez benefician fuertemente a los activos digitales.".into(),
                top_picks: vec!["BTC".into(), "ETH".into(), "SOL".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Materias Primas (Commodities)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -10.0,
                rationale: "Aún rezagadas frente al dinamismo de la renta variable tecnológica y de consumo.".into(),
                top_picks: vec!["CPER".into()],
                avoid: vec!["DBC".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "Costo de oportunidad elevado de mantener liquidez en un bull market desatado.".into(),
                top_picks: vec![],
                avoid: vec!["UUP".into()],
            },
        ],
        3 => vec![
            TacticalAssetAllocation {
                asset_class: "Materias Primas (Commodities)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 20.0,
                rationale: "Plena expansión y demanda industrial global impulsan precios de insumos, energía y metales.".into(),
                top_picks: vec!["DBC".into(), "XLE".into(), "CPER".into(), "GLD".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar (Rotación)".into(),
                weight_delta_pct: 15.0,
                rationale: "Rotar hacia sectores sensibles a inflación, materiales, industriales y financieros.".into(),
                top_picks: vec!["XLI".into(), "XLF".into(), "XLE".into()],
                avoid: vec!["Tech alta valuación".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Toma Parcial".into(),
                weight_delta_pct: 0.0,
                rationale: "Madurez del rally; consolidación y rotación de ganancias hacia activos reales.".into(),
                top_picks: vec!["BTC".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -20.0,
                rationale: "La suba de tasas y rendimientos deprime el precio de los títulos de deuda de largo plazo.".into(),
                top_picks: vec!["SHY".into(), "TIP".into()],
                avoid: vec!["TLT".into(), "IEF".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "neutral".into(),
                stance_label: "Neutral".into(),
                weight_delta_pct: 0.0,
                rationale: "Tasas de interés atractivas en dinero a la vista / instrumentos monetarios.".into(),
                top_picks: vec!["BIL".into()],
                avoid: vec![],
            },
        ],
        4 => vec![
            TacticalAssetAllocation {
                asset_class: "Materias Primas & Energía".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 15.0,
                rationale: "Último bastión del ciclo alcista; cobertura esencial contra la aceleración de precios.".into(),
                top_picks: vec!["DBC".into(), "XLE".into(), "GLD".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar".into(),
                weight_delta_pct: 20.0,
                rationale: "Asegurar rentabilidad a tasas altas libres de riesgo y proteger capital ante caídas.".into(),
                top_picks: vec!["BIL".into(), "UUP".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "Presión en múltiplos de valuación y contracción de márgenes por tasas y costos elevados.".into(),
                top_picks: vec!["XLP".into(), "XLV".into()],
                avoid: vec!["QQQ".into(), "XLY".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "La astringencia monetaria y las altas tasas drenan liquidez de activos especulativos.".into(),
                top_picks: vec![],
                avoid: vec!["BTC".into(), "Altcoins".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Duración Corta".into(),
                weight_delta_pct: 0.0,
                rationale: "Mantener bonos de corto plazo a la espera del techo definitivo en las tasas del Tesoro.".into(),
                top_picks: vec!["SHY".into()],
                avoid: vec!["TLT".into()],
            },
        ],
        5 => vec![
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar Fuerte".into(),
                weight_delta_pct: 30.0,
                rationale: "La liquidez es reina; preservación estricta de capital mientras los activos corrigen.".into(),
                top_picks: vec!["BIL".into(), "UUP".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Monitorear Giro".into(),
                weight_delta_pct: 5.0,
                rationale: "Comenzar a vigilar compras escalonadas de bonos soberanos de alta calidad crediticia.".into(),
                top_picks: vec!["IEF".into(), "TLT".into()],
                avoid: vec!["HYG".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar Fuerte".into(),
                weight_delta_pct: -25.0,
                rationale: "Mercado bajista activo; caídas en utilidades y riesgo de desapalancamiento.".into(),
                top_picks: vec!["XLP".into(), "XLU".into()],
                avoid: vec!["XLI".into(), "XLF".into(), "QQQ".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Materias Primas (Commodities)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar Fuerte".into(),
                weight_delta_pct: -20.0,
                rationale: "Desplome de la demanda global; liquidación en crudo, metales y commodities agrícolas.".into(),
                top_picks: vec!["GLD".into()],
                avoid: vec!["DBC".into(), "CPER".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "Aversión extrema al riesgo y desapalancamiento institucional en el ecosistema cripto.".into(),
                top_picks: vec![],
                avoid: vec!["BTC".into(), "Altcoins".into()],
            },
        ],
        _ => vec![
            TacticalAssetAllocation {
                asset_class: "Renta Fija Soberana (Bonos)".into(),
                stance: "overweight".into(),
                stance_label: "Sobreponderar Fuerte".into(),
                weight_delta_pct: 25.0,
                rationale: "El giro de tasas y la recesión provocan un fuerte rally alcista en bonos del Tesoro.".into(),
                top_picks: vec!["TLT".into(), "IEF".into(), "AGG".into()],
                avoid: vec!["HYG".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Efectivo / Dólar".into(),
                stance: "neutral".into(),
                stance_label: "Neutral".into(),
                weight_delta_pct: 0.0,
                rationale: "Mantener liquidez para desplegar a medida que las valoraciones toquen piso histórico.".into(),
                top_picks: vec!["BIL".into()],
                avoid: vec![],
            },
            TacticalAssetAllocation {
                asset_class: "Renta Variable (Acciones)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Caza de Oportunidades".into(),
                weight_delta_pct: -5.0,
                rationale: "Fase terminal de caídas; buscar empresas defensivas de balance impecable con altos dividendos.".into(),
                top_picks: vec!["XLV".into(), "XLP".into(), "SPY".into()],
                avoid: vec!["Compañías altamente endeudadas".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Materias Primas (Commodities)".into(),
                stance: "underweight".into(),
                stance_label: "Subponderar".into(),
                weight_delta_pct: -15.0,
                rationale: "Impacto recesivo profundo; los commodities tardan más tiempo en formar suelo.".into(),
                top_picks: vec!["GLD".into()],
                avoid: vec!["DBC".into()],
            },
            TacticalAssetAllocation {
                asset_class: "Criptoactivos (BTC)".into(),
                stance: "neutral".into(),
                stance_label: "Neutral / Vigilancia".into(),
                weight_delta_pct: 0.0,
                rationale: "Monitorear divergencias de volumen y acumulación de holders de largo plazo.".into(),
                top_picks: vec!["BTC".into()],
                avoid: vec![],
            },
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_ratios(sb_t: TrendDirection, cd_t: TrendDirection, cb_t: TrendDirection, d_t: TrendDirection) -> KeyRatios {
        KeyRatios {
            stock_bond: 1.0,
            stock_bond_trend: sb_t,
            cyclical_defensive: 1.0,
            cyclical_defensive_trend: cd_t,
            commodity_bond: 1.0,
            commodity_bond_trend: cb_t,
            dollar_ratio: 1.0,
            dollar_trend: d_t,
            copper_gold: 1.0,
            copper_gold_trend: cd_t,
            credit_spread: 1.0,
            credit_spread_trend: sb_t,
            crypto_gold: 1.0,
            crypto_gold_trend: sb_t,
            commodity_stock: 1.0,
            commodity_stock_trend: cb_t,
            inflation_expectation: 1.0,
            inflation_expectation_trend: cb_t,
            duration_slope: 1.0,
            duration_slope_trend: sb_t,
        }
    }

    #[test]
    fn test_detect_expansion() {
        let r = make_test_ratios(TrendDirection::Rising, TrendDirection::Rising, TrendDirection::Rising, TrendDirection::Falling);
        let res = detect_murphy_cycle(&[], &r);
        assert!(matches!(res.phase, MarketPhase::EarlyExpansion | MarketPhase::LateExpansion));
        assert!(res.confidence > 0.3);
        assert_eq!(res.indicators.len(), 7);
        assert!(!res.tactical_allocation.is_empty());
    }

    #[test]
    fn test_detect_contraction() {
        let r = make_test_ratios(TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Rising);
        let res = detect_murphy_cycle(&[], &r);
        assert!(matches!(res.phase, MarketPhase::Contraction | MarketPhase::Trough));
        assert!(res.confidence > 0.3);
    }

    #[test]
    fn test_detect_peak() {
        let r = make_test_ratios(TrendDirection::Falling, TrendDirection::Falling, TrendDirection::Rising, TrendDirection::Rising);
        let res = detect_murphy_cycle(&[], &r);
        assert!(matches!(res.phase, MarketPhase::Peak | MarketPhase::LateExpansion | MarketPhase::Contraction));
    }

    #[test]
    fn test_phase_labels() {
        assert_eq!(MarketPhase::EarlyExpansion.label(), "Expansión Temprana");
        assert_eq!(MarketPhase::Contraction.label(), "Contracción");
        assert_eq!(MarketPhase::Peak.emoji(), "⛰️");
    }

    #[test]
    fn test_all_neutral_is_early_expansion() {
        let r = make_test_ratios(TrendDirection::Sideways, TrendDirection::Sideways, TrendDirection::Sideways, TrendDirection::Sideways);
        let res = detect_murphy_cycle(&[], &r);
        assert!(res.confidence >= 0.3);
    }
}
