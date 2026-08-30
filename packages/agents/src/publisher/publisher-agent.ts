import {
  createPartFromText,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import { env } from '@studioflow/config';
import { validateMediaJob } from '../director/workflow-plan';
import { buildPublisherPrompt, PUBLISHER_SYSTEM_INSTRUCTION } from './prompt';
import { PUBLISHER_RESPONSE_SCHEMA } from './schema';
import {
  createFallbackPublisherResult,
  parsePublisherResponse,
} from './publisher-result';
import type { PublisherAnalysisResult, PublisherRequest } from './types';

export interface PublisherAgentOptions {
  aiClient?: GoogleGenAI | null;
  now?: () => Date;
}

export class PublisherAgent {
  private readonly aiClient?: GoogleGenAI;
  private readonly now: () => Date;

  constructor(options: PublisherAgentOptions = {}) {
    this.now = options.now || (() => new Date());

    if (options.aiClient !== undefined) {
      this.aiClient = options.aiClient || undefined;
      return;
    }

    if (env.geminiApiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
      } catch (error) {
        console.warn('⚠️ [PublisherAgent] Failed to initialize GoogleGenAI client:', error);
      }
    }
  }

  public async analyze(request: PublisherRequest): Promise<PublisherAnalysisResult> {
    this.validateRequest(request);
    const generatedAt = this.now().toISOString();

    if (!this.aiClient) {
      return createFallbackPublisherResult(request, generatedAt);
    }

    try {
      const prompt = buildPublisherPrompt(request);

      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: PUBLISHER_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: PUBLISHER_RESPONSE_SCHEMA,
        },
        contents: createUserContent([createPartFromText(prompt)]),
      });

      const parsed = parsePublisherResponse(response.text ?? '');

      return {
        projectId: request.projectId,
        mediaId: request.media.id,
        summary: parsed.summary,
        platforms: parsed.platforms,
        source: 'gemini',
        generatedAt,
      };
    } catch (error) {
      console.warn('⚠️ [PublisherAgent] Falling back to unavailable publisher result:', error);
      return createFallbackPublisherResult(request, generatedAt);
    }
  }

  private validateRequest(request: PublisherRequest): void {
    validateMediaJob({
      projectId: request.projectId,
      objective: 'Generate platform publishing metadata.',
      media: request.media,
    });
  }
}
