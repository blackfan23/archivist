export interface AISettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'claude' | 'none';
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  claudeApiKey?: string;
  claudeModel?: string;
}

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant integrated into a media archiving application.';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3-coder:latest',
  openaiModel: 'gpt-4-turbo',
  geminiModel: 'gemini-1.5-pro',
  claudeModel: 'claude-3-opus-20240229',
};

export interface GenerateRequest {
  prompt: string;
  context?: string;
  systemPrompt?: string;
}

export interface GenerateResponse {
  text: string;
  error?: string;
}
