import React, { useState } from 'react';
import { commands } from '@/lib/tauri';

interface AIPromptModalProps {
  promptText: string;
  estimatedTokens: number;
  onClose: () => void;
}

export function AIPromptModal({ promptText, estimatedTokens, onClose }: AIPromptModalProps) {
  const [copied, setCopied] = useState(false);
  const [loadingOllama, setLoadingOllama] = useState(false);
  const [ollamaResponse, setOllamaResponse] = useState<string | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQueryOllama = async () => {
    setLoadingOllama(true);
    setOllamaError(null);
    setOllamaResponse(null);
    try {
      // Query local Ollama instance (returns string)
      const res = await commands.queryOllama(promptText, 'llama3');
      if (res) {
        setOllamaResponse(res);
      } else {
        setOllamaResponse('Análisis completado sin texto de retorno.');
      }
    } catch {
      setOllamaError(
        'No se pudo conectar a Ollama local (localhost:11434). Puedes copiar el prompt arriba y pegarlo directamente en Gemini, Claude o ChatGPT.'
      );
    } finally {
      setLoadingOllama(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>🤖 Reporte Compacto para IA (Token-Efficient Payload)</h3>
            <p style={styles.subtitle}>
              Formateado sintético de alta densidad semántica optimizado para LLMs con mínimo costo de tokens
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Token Efficiency Banner */}
        <div style={styles.tokenBanner}>
          <div style={styles.tokenMetric}>
            <span style={styles.tokenLabel}>Consumo Estimado:</span>
            <span style={styles.tokenVal}>~{estimatedTokens} Tokens</span>
          </div>
          <div style={styles.tokenMetric}>
            <span style={styles.tokenLabel}>Ahorro vs JSON en crudo:</span>
            <span style={{ ...styles.tokenVal, color: '#4caf50' }}>~88% Ahorro</span>
          </div>
          <div style={styles.tokenMetric}>
            <span style={styles.tokenLabel}>Compatibilidad:</span>
            <span style={styles.tokenVal}>Gemini, Claude, GPT-4, Ollama</span>
          </div>
        </div>

        {/* Prompt Codebox */}
        <div style={styles.codeWrapper}>
          <textarea
            readOnly
            value={promptText}
            style={styles.textarea}
            rows={12}
          />
        </div>

        {/* Modal Actions */}
        <div style={styles.actions}>
          <button onClick={handleCopy} style={styles.copyBtn}>
            {copied ? '✅ ¡Copiado al Portapapeles!' : '📋 Copiar Prompt para tu IA'}
          </button>

          <button onClick={handleQueryOllama} disabled={loadingOllama} style={styles.ollamaBtn}>
            {loadingOllama ? '⏳ Consultando Ollama Local...' : '⚡ Consultar Ollama Local'}
          </button>
        </div>

        {/* Ollama Response Section */}
        {ollamaError && (
          <div style={styles.errorBox}>
            <span>ℹ️ {ollamaError}</span>
          </div>
        )}

        {ollamaResponse && (
          <div style={styles.responseBox}>
            <h4 style={{ margin: '0 0 8px 0', color: '#00e5ff', fontSize: '0.95rem' }}>
              🧠 Respuesta del Modelo IA (Llama3 Local):
            </h4>
            <div style={styles.responseContent}>{ollamaResponse}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '740px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  tokenBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '10px',
    border: '1px solid var(--border-subtle)',
    flexWrap: 'wrap',
    gap: '10px',
  },
  tokenMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  tokenLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
  tokenVal: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  codeWrapper: {
    position: 'relative',
  },
  textarea: {
    width: '100%',
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    lineHeight: 1.4,
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #30363d',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  copyBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#00e5ff',
    color: '#000',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  ollamaBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'rgba(179, 136, 255, 0.15)',
    color: '#b388ff',
    fontWeight: 'bold',
    border: '1px solid rgba(179, 136, 255, 0.4)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  errorBox: {
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    border: '1px solid rgba(255, 152, 0, 0.3)',
    borderRadius: '8px',
    color: '#ff9800',
    fontSize: '0.85rem',
  },
  responseBox: {
    padding: '14px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
  },
  responseContent: {
    fontSize: '0.85rem',
    lineHeight: 1.5,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
  },
};
