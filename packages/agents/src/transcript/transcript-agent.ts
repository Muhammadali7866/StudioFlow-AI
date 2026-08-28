import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  createPartFromText,
  createPartFromUri,
  createPartFromVideoMetadata,
  createUserContent,
  FileState,
  GoogleGenAI,
} from '@google/genai';
import type { Part } from '@google/genai';
import { env } from '@studioflow/config';
import { validateMediaJob } from '../director/workflow-plan';
import { buildTranscriptPrompt, TRANSCRIPT_SYSTEM_INSTRUCTION } from './prompt';
import { TRANSCRIPT_RESPONSE_SCHEMA } from './schema';
import {
  createFallbackTranscriptResult,
  mergeTranscriptChunks,
  parseTranscriptChunkResponse,
} from './transcript-result';
import type { TranscriptChunkResult } from './transcript-result';
import type { TranscriptAnalysisResult, TranscriptMediaSource, TranscriptRequest } from './types';

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
    this.maxVideoChunkSeconds = options.maxVideoChunkSeconds || 30 * 60;
    this.filePollIntervalMs = options.filePollIntervalMs || 2_000;
    this.maxFilePollAttempts = options.maxFilePollAttempts || 60;
    this.sleep =
      options.sleep ||
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now || (() => new Date());

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
      const mediaPart = await this.createMediaPart(request);
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

  private async createMediaPart(request: TranscriptRequest): Promise<Part> {
    const source =
      request.source ||
      (request.media.uri ? ({ kind: 'uri', uri: request.media.uri } as const) : undefined);

    if (!source) {
      throw new Error('Transcript media must provide a URI, file path, Blob, or readable stream.');
    }

    if (source.kind === 'uri') {
      return createPartFromUri(source.uri, request.media.mimeType);
    }

    if (source.kind === 'stream') {
      return this.uploadStream(source, request);
    }

    const uploadSource = source.kind === 'path' ? source.path : source.blob;
    return this.uploadFile(uploadSource, request);
  }

  private async uploadStream(
    source: Extract<TranscriptMediaSource, { kind: 'stream' }>,
    request: TranscriptRequest
  ): Promise<Part> {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'studioflow-transcript-'));
    const extension = extname(request.media.fileName).slice(0, 16);
    const temporaryPath = join(temporaryDirectory, `source${extension}`);

    try {
      await pipeline(source.stream, createWriteStream(temporaryPath));
      return await this.uploadFile(temporaryPath, request);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  private async uploadFile(source: string | Blob, request: TranscriptRequest): Promise<Part> {
    if (!this.aiClient) {
      throw new Error('Gemini client is unavailable.');
    }

    let file = await this.aiClient.files.upload(source, {
      mimeType: request.media.mimeType,
      displayName: request.media.fileName,
    });

    for (let attempt = 0; file.state === FileState.PROCESSING; attempt += 1) {
      if (attempt >= this.maxFilePollAttempts || !file.name) {
        throw new Error('Timed out while waiting for Gemini to process the media file.');
      }

      await this.sleep(this.filePollIntervalMs);
      file = await this.aiClient.files.get({ name: file.name });
    }

    if (file.state === FileState.FAILED) {
      throw new Error(file.error?.message || 'Gemini failed to process the media file.');
    }

    if (!file.uri) {
      throw new Error('Gemini file upload did not return a media URI.');
    }

    return createPartFromUri(file.uri, file.mimeType || request.media.mimeType);
  }
}

export const transcriptAgent = new TranscriptAgent();
