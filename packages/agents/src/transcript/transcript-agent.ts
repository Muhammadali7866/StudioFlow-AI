import {
  createPartFromText,
  createPartFromVideoMetadata,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import type { Part } from '@google/genai';
import { env } from '@studioflow/config';
import { validateMediaJob } from '../director/workflow-plan';
import { createGeminiMediaPart } from '../media/gemini-media';
import { buildTranscriptPrompt, TRANSCRIPT_SYSTEM_INSTRUCTION } from './prompt';
import { TRANSCRIPT_RESPONSE_SCHEMA } from './schema';
import {
  createFallbackTranscriptResult,
  mergeTranscriptChunks,
  parseTranscriptChunkResponse,
} from './transcript-result';
import type { TranscriptChunkResult } from './transcript-result';
import type { TranscriptAnalysisResult, TranscriptRequest } from './types';

interface TranscriptRange {
  startSeconds: number;
  endSeconds?: number;
  clipped: boolean;
}

export interface TranscriptAgentOptions {
  aiClient?: GoogleGenAI | null;
  maxVideoChunkSeconds?: number;
  filePollIntervalMs?: number;
  maxFilePollAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}

export class TranscriptAgent {
  private readonly aiClient?: GoogleGenAI;
  private readonly maxVideoChunkSeconds: number;
  private readonly filePollIntervalMs: number;
  private readonly maxFilePollAttempts: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;

  constructor(options: TranscriptAgentOptions = {}) {
    this.maxVideoChunkSeconds = options.maxVideoChunkSeconds ?? 30 * 60;
    this.filePollIntervalMs = options.filePollIntervalMs ?? 2_000;
    this.maxFilePollAttempts = options.maxFilePollAttempts ?? 60;
    this.sleep =
      options.sleep ||
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now || (() => new Date());

    if (this.maxVideoChunkSeconds <= 0) {
      throw new Error('maxVideoChunkSeconds must be positive.');
    }

    if (this.filePollIntervalMs < 0 || this.maxFilePollAttempts <= 0) {
      throw new Error('Gemini file polling options must be non-negative.');
    }

    if (options.aiClient !== undefined) {
      this.aiClient = options.aiClient || undefined;
      return;
    }

    if (env.geminiApiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
      } catch (error) {
        console.warn('⚠️ [TranscriptAgent] Failed to initialize GoogleGenAI client:', error);
      }
    }
  }

  public async analyze(request: TranscriptRequest): Promise<TranscriptAnalysisResult> {
    this.validateRequest(request);
    const generatedAt = this.now().toISOString();

    if (!this.aiClient) {
      return createFallbackTranscriptResult(request, generatedAt);
    }

    try {
      const mediaPart = await createGeminiMediaPart({
        aiClient: this.aiClient,
        media: request.media,
        source: request.source,
        filePollIntervalMs: this.filePollIntervalMs,
        maxFilePollAttempts: this.maxFilePollAttempts,
        sleep: this.sleep,
        temporaryPrefix: 'studioflow-transcript-',
      });
      const chunks: TranscriptChunkResult[] = [];

      for (const range of this.createRanges(request)) {
        const parts: Part[] = [mediaPart];

        if (range.clipped && range.endSeconds !== undefined) {
          parts.push(createPartFromVideoMetadata(`${range.startSeconds}s`, `${range.endSeconds}s`));
        }

        parts.push(createPartFromText(buildTranscriptPrompt(request, range)));

        const response = await this.aiClient.models.generateContent({
          model: env.geminiModel || 'gemini-2.5-flash',
          contents: createUserContent(parts),
          config: {
            systemInstruction: TRANSCRIPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: TRANSCRIPT_RESPONSE_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        });

        if (!response.text) {
          throw new Error('Gemini returned an empty transcript response.');
        }

        chunks.push(parseTranscriptChunkResponse(response.text, range.startSeconds));
      }

      return mergeTranscriptChunks(request, chunks, generatedAt);
    } catch (error) {
      console.warn('⚠️ [TranscriptAgent] Falling back to an unavailable transcript result:', error);
      return createFallbackTranscriptResult(request, generatedAt);
    }
  }

  private validateRequest(request: TranscriptRequest): void {
    validateMediaJob({
      projectId: request.projectId,
      objective: 'Generate a structured transcript.',
      media: request.media,
    });

    if (request.languageHint !== undefined && request.languageHint.trim().length === 0) {
      throw new Error('languageHint must be non-empty when provided.');
    }
  }

  private createRanges(request: TranscriptRequest): TranscriptRange[] {
    const duration = request.media.durationSeconds;
    const isLongVideo =
      request.media.mimeType.startsWith('video/') &&
      duration !== undefined &&
      duration > this.maxVideoChunkSeconds;

    if (!isLongVideo || duration === undefined) {
      return [{ startSeconds: 0, endSeconds: duration, clipped: false }];
    }

    const ranges: TranscriptRange[] = [];
    for (let startSeconds = 0; startSeconds < duration; startSeconds += this.maxVideoChunkSeconds) {
      ranges.push({
        startSeconds,
        endSeconds: Math.min(duration, startSeconds + this.maxVideoChunkSeconds),
        clipped: true,
      });
    }

    return ranges;
  }
}

export const transcriptAgent = new TranscriptAgent();
