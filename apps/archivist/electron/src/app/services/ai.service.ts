import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AISettings,
  DEFAULT_SYSTEM_PROMPT,
  GenerateRequest,
  GenerateResponse,
} from '@medularity/archivist-core';
import { Ollama } from 'ollama';
import OpenAI from 'openai';

export const AIService = {
  /**
   * Generate text using the configured AI provider
   */
  async generate(
    settings: AISettings,
    request: GenerateRequest,
  ): Promise<GenerateResponse> {
    const { provider } = settings;
    const systemPrompt = request.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Construct prompt with context
    const fullPrompt = request.context
      ? `Context from the current project:\n\n${request.context}\n\n---\n\nUser request: ${request.prompt}`
      : request.prompt;

    try {
      switch (provider) {
        case 'ollama':
          return await this.generateOllama(settings, systemPrompt, fullPrompt);
        case 'openai':
          return await this.generateOpenAI(settings, systemPrompt, fullPrompt);
        case 'claude':
          return await this.generateClaude(settings, systemPrompt, fullPrompt);
        case 'gemini':
          return await this.generateGemini(settings, systemPrompt, fullPrompt);
        case 'none':
        default:
          return { text: '', error: 'No AI provider configured' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { text: '', error: message };
    }
  },

  /**
   * Ollama (local) generation
   */
  async generateOllama(
    settings: AISettings,
    systemPrompt: string,
    prompt: string,
  ): Promise<GenerateResponse> {
    const ollama = new Ollama({ host: settings.ollamaUrl });

    try {
      const response = await ollama.chat({
        model: settings.ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });

      return { text: response.message.content };
    } catch (error) {
      if (error instanceof Error && error.message.includes('try pulling it')) {
        return {
          text: '',
          error: `Model '${settings.ollamaModel}' not found. Please run 'ollama pull ${settings.ollamaModel}' in your terminal.`,
        };
      }
      throw error;
    }
  },

  /**
   * OpenAI generation
   */
  async generateOpenAI(
    settings: AISettings,
    systemPrompt: string,
    prompt: string,
  ): Promise<GenerateResponse> {
    if (!settings.openaiApiKey) {
      return { text: '', error: 'OpenAI API key is missing' };
    }

    const openai = new OpenAI({ apiKey: settings.openaiApiKey });
    const model = settings.openaiModel || 'gpt-4-turbo';

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    return { text: response.choices[0]?.message?.content || '' };
  },

  /**
   * Anthropic (Claude) generation
   */
  async generateClaude(
    settings: AISettings,
    systemPrompt: string,
    prompt: string,
  ): Promise<GenerateResponse> {
    if (!settings.claudeApiKey) {
      return { text: '', error: 'Claude API key is missing' };
    }

    const anthropic = new Anthropic({ apiKey: settings.claudeApiKey });
    const model = settings.claudeModel || 'claude-3-5-sonnet-20241022';

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    // Narrow type before accessing .text to avoid implicit cast
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return { text };
  },

  /**
   * Google Gemini generation
   */
  async generateGemini(
    settings: AISettings,
    systemPrompt: string,
    prompt: string,
  ): Promise<GenerateResponse> {
    if (!settings.geminiApiKey) {
      return { text: '', error: 'Gemini API key is missing' };
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const modelName = settings.geminiModel || 'gemini-1.5-pro';
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return { text: response.text() };
  },

  /**
   * Test connection to the configured provider
   */
  async testConnection(
    settings: AISettings,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.generate(settings, { prompt: 'Hi' });
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Connection failed';
      return { success: false, error: message };
    }
  },

  /**
   * List available Ollama models
   */
  async listOllamaModels(ollamaUrl: string): Promise<string[]> {
    try {
      const ollama = new Ollama({ host: ollamaUrl });
      const response = await ollama.list();
      return response.models.map((m) => m.name);
    } catch {
      return [];
    }
  },

  /**
   * Pull an Ollama model
   */
  async pullOllamaModel(ollamaUrl: string, model: string): Promise<void> {
    const ollama = new Ollama({ host: ollamaUrl });
    await ollama.pull({ model });
  },
};
