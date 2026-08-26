import { GoogleGenAI } from '@google/genai';
import { env } from '@studioflow/config';
import { AgentResponse } from '@studioflow/shared';

export class RootAgent {
  private name = 'RootAgent';
  private aiClient?: GoogleGenAI;

  constructor() {
    if (env.geminiApiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
      } catch (err) {
        console.warn('⚠️ [RootAgent] Failed to initialize GoogleGenAI client:', err);
      }
    }
  }

  public async processMessage(userMessage: string): Promise<AgentResponse> {
    const defaultPrefix = 'StudioFlow AI agent is running.';
    const timestamp = new Date().toISOString();

    if (!userMessage || userMessage.trim().length === 0) {
      return {
        agentName: this.name,
        status: 'ok',
        message: defaultPrefix,
        timestamp,
      };
    }

    if (this.aiClient) {
      try {
        const response = await this.aiClient.models.generateContent({
          model: env.geminiModel || 'gemini-2.5-flash',
          contents: userMessage,
        });

        const reply = response.text || defaultPrefix;

        return {
          agentName: this.name,
          status: 'ok',
          message: reply,
          geminiRawResponse: reply,
          isFallback: false,
          timestamp,
        };
      } catch (error: any) {
        console.error('❌ [RootAgent Gemini Error]:', error?.message || error);
        return {
          agentName: this.name,
          status: 'ok',
          message: `${defaultPrefix} (Gemini fallback response for prompt: "${userMessage}")`,
          isFallback: true,
          timestamp,
        };
      }
    }

    return {
      agentName: this.name,
      status: 'ok',
      message: `${defaultPrefix} Prompt received: "${userMessage}"`,
      isFallback: true,
      timestamp,
    };
  }
}

export const rootAgent = new RootAgent();

