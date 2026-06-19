//! Analysis Module Framework (Open-Closed Principle)
//!
//! Each market analysis module implements the `AnalysisModule` trait.
//! Modules are independent, composable, and follow the pipeline:
//!
//! Intermarket → Topology → MarketAccess → ElliottWave → RelativePerf → Portfolio

pub mod elliott_wave;
pub mod intermarket;
pub mod topology;

use serde_json::Value;
use sqlx::SqlitePool;
use async_trait::async_trait;
use anyhow::Result;

/// What data a module needs to run
#[derive(Debug, Clone)]
pub struct DataRequirement {
    pub symbol: String,
    pub range: String,
    pub description: String,
}

/// Context provided to every module at analysis time
#[derive(Debug, Clone)]
pub struct ModuleContext {
    pub db: SqlitePool,
    pub symbols: Vec<String>,
    pub parameters: Value,
}

/// Every analysis module implements this trait
#[async_trait]
pub trait AnalysisModule: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn requirements(&self) -> Vec<DataRequirement>;
    async fn analyze(&self, ctx: &ModuleContext) -> Result<Box<dyn ModuleOutput>>;
}

/// Output from any analysis module — serializable to JSON for the UI
#[async_trait]
pub trait ModuleOutput: Send + Sync {
    fn as_json(&self) -> Value;
    fn module_name(&self) -> &str;
}

/// Register all available analysis modules
pub fn available_modules() -> Vec<Box<dyn AnalysisModule>> {
    vec![
        Box::new(intermarket::IntermarketModule::default()),
        Box::new(topology::TopologyModule::default()),
        Box::new(elliott_wave::ElliottWaveModule::default()),
    ]
}
