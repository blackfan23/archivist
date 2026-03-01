export type AiProvider = 'none' | 'ollama' | 'openai' | 'claude' | 'gemini';

export interface AiModelSettings {
  provider: AiProvider;
  ollamaUrl?: string;
  ollamaModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  claudeApiKey?: string;
  claudeModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface OllamaModelInfo {
  name: string;
  // Add other fields if needed, like size, modified_at, etc.
}

export interface AiModelLabels {
  provider: string;
  providerDesc: string;
  providerNone: string;
  providerOllama: string;
  providerOpenai: string;
  providerClaude: string;
  providerGemini: string;
  ollamaUrl: string;
  model: string;
  apiKey: string;
  testConnection: string;
  testing: string;
  connectionStatus: string;
  connected: string;
  failed: string;
  refresh?: string;
}
