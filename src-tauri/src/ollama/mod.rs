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

/// Ping local Ollama instance URL to check connectivity.
pub async fn ping_ollama_url(url: &str) -> bool {
    let client_res = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_millis(1500))
        .timeout(std::time::Duration::from_millis(1500))
        .build();

    let client = match client_res {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client.get(url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Ping local Ollama instance to check connectivity.
pub async fn ping_ollama() -> bool {
    ping_ollama_url("http://localhost:11434").await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn test_ping_ollama_failure() {
        // Hitting an unused port should fail/return false
        let res = ping_ollama_url("http://127.0.0.1:1").await;
        assert!(!res);
    }

    #[tokio::test]
    async fn test_ping_ollama_success() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let url = format!("http://{}", addr);

        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0u8; 1024];
                use tokio::io::AsyncReadExt;
                let _ = socket.read(&mut buf).await;

                let response = "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 17\r\n\r\nOllama is running";
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });

        let res = ping_ollama_url(&url).await;
        assert!(res);
    }
}

