//! Ollama integration module
//!
//! Connects to local Ollama instances to use LLMs for:
//! - Natural language market analysis
//! - Pattern recognition in charts
//! - Sentiment analysis on news
//! - Strategy reasoning and explanation

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Ollama request payload
#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
    pub options: Option<OllamaOptions>,
}

/// Ollama generation options
#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaOptions {
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<u32>,
}

/// Ollama response
#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaResponse {
    pub model: String,
    pub response: String,
    pub done: bool,
}

/// Send a prompt to a local Ollama instance
pub async fn query_ollama(
    model: &str,
    prompt: &str,
    options: Option<OllamaOptions>,
) -> Result<OllamaResponse> {
    let client = reqwest::Client::new();
    let request = OllamaRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: false,
        options,
    };

    let resp = client
        .post("http://localhost:11434/api/generate")
        .json(&request)
        .send()
        .await?;

    let result: OllamaResponse = resp.json().await?;
    Ok(result)
}

/// Analyze market conditions using an LLM
pub async fn analyze_market_context(
    model: &str,
    market_data_summary: &str,
) -> Result<String> {
    let prompt = format!(
        r#"You are a senior market analyst. Based on the following market data summary, 
provide a concise analysis of current market conditions, key levels to watch, 
and potential trading opportunities.

Market Data:
{}

Analysis:"#,
        market_data_summary
    );

    let response = query_ollama(model, &prompt, Some(OllamaOptions {
        temperature: Some(0.3),
        top_p: Some(0.9),
        max_tokens: Some(500),
    })).await?;

    Ok(response.response)
}
