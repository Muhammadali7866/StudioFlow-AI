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
import { buildAssetPrompt, ASSET_SYSTEM_INSTRUCTION } from './prompt';
import { ASSET_ANALYSIS_RESPONSE_SCHEMA } from './schema';
import {
  createFallbackAssetResult,
  mergeAssetChunks,
  parseAssetChunkResponse,
} from './asset-result';
import type { AssetChunkResult } from './asset-result';
import type { AssetAnalysisRequest, AssetAnalysisResult } from './types';

interface AssetRange {
  startSeconds: number;
  endSeconds?: number;
  clipped: boolean;
}

export interface AssetAgentOptions {
  aiClient?: GoogleGenAI | null;
  maxVideoChunkSeconds?: number;
  filePollIntervalMs?: number;
  maxFilePollAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}

export class AssetAgent {
  private readonly aiClient?: GoogleGenAI;
  private readonly maxVideoChunkSeconds: number;
  private readonly filePollIntervalMs: number;
  private readonly maxFilePollAttempts: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;

  constructor(options: AssetAgentOptions = {}) {
    this.maxVideoChunkSeconds = options.maxVideoChunkSeconds ?? 15 * 60;
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
        console.warn('⚠️ [AssetAgent] Failed to initialize GoogleGenAI client:', error);
      }
    }
  }

  public async analyze(request: AssetAnalysisRequest): Promise<AssetAnalysisResult> {
    this.validateRequest(request);
    const generatedAt = this.now().toISOString();

    if (!this.aiClient) {
      return createFallbackAssetResult(request, generatedAt);
    }

    try {
      const mediaPart = await createGeminiMediaPart({
        aiClient: this.aiClient,
        media: request.media,
        source: request.source,
        filePollIntervalMs: this.filePollIntervalMs,
        maxFilePollAttempts: this.maxFilePollAttempts,
        sleep: this.sleep,
        temporaryPrefix: 'studioflow-asset-',
      });
      const chunks: AssetChunkResult[] = [];

      for (const range of this.createRanges(request)) {
        const parts: Part[] = [mediaPart];

        if (range.clipped && range.endSeconds !== undefined) {
          parts.push(createPartFromVideoMetadata(`${range.startSeconds}s`, `${range.endSeconds}s`));
        }

        parts.push(createPartFromText(buildAssetPrompt(request, range)));

        const response = await this.aiClient.models.generateContent({
          model: env.geminiModel || 'gemini-2.5-flash',
          contents: createUserContent(parts),
          config: {
            systemInstruction: ASSET_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: ASSET_ANALYSIS_RESPONSE_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        });

        if (!response.text) {
          throw new Error('Gemini returned an empty asset analysis response.');
        }

        chunks.push(parseAssetChunkResponse(response.text, range.startSeconds));
      }

      return mergeAssetChunks(request, chunks, generatedAt);
    } catch (error) {
      console.warn('⚠️ [AssetAgent] Falling back to an unavailable asset result:', error);
      return createFallbackAssetResult(request, generatedAt);
    }
  }

  private validateRequest(request: AssetAnalysisRequest): void {
    validateMediaJob({
      projectId: request.projectId,
      objective: 'Generate visual scene and asset metadata.',
      media: request.media,
    });

    if (!request.media.mimeType.startsWith('video/')) {
      throw new Error('AssetAgent requires video media.');
    }
  }

  private createRanges(request: AssetAnalysisRequest): AssetRange[] {
    const duration = request.media.durationSeconds;

    if (duration === undefined || duration <= this.maxVideoChunkSeconds) {
      return [{ startSeconds: 0, endSeconds: duration, clipped: false }];
    }

    const ranges: AssetRange[] = [];
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

export const assetAgent = new AssetAgent();
