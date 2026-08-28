import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createPartFromUri, FileState, GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';
import type { MediaMetadata } from '../director/types';
import type { GeminiMediaSource } from './types';

export interface GeminiMediaResolverOptions {
  aiClient: GoogleGenAI;
  media: MediaMetadata;
  source?: GeminiMediaSource;
  filePollIntervalMs?: number;
  maxFilePollAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  temporaryPrefix?: string;
}

async function uploadFile(
  source: string | Blob,
  options: GeminiMediaResolverOptions
): Promise<Part> {
  let file = await options.aiClient.files.upload(source, {
    mimeType: options.media.mimeType,
    displayName: options.media.fileName,
  });
  const pollIntervalMs = options.filePollIntervalMs ?? 2_000;
  const maxPollAttempts = options.maxFilePollAttempts ?? 60;
  const sleep =
    options.sleep ||
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  for (let attempt = 0; file.state === FileState.PROCESSING; attempt += 1) {
    if (attempt >= maxPollAttempts || !file.name) {
      throw new Error('Timed out while waiting for Gemini to process the media file.');
    }

    await sleep(pollIntervalMs);
    file = await options.aiClient.files.get({ name: file.name });
  }

  if (file.state === FileState.FAILED) {
    throw new Error(file.error?.message || 'Gemini failed to process the media file.');
  }

  if (!file.uri) {
    throw new Error('Gemini file upload did not return a media URI.');
  }

  return createPartFromUri(file.uri, file.mimeType || options.media.mimeType);
}

async function uploadStream(
  source: Extract<GeminiMediaSource, { kind: 'stream' }>,
  options: GeminiMediaResolverOptions
): Promise<Part> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), options.temporaryPrefix || 'studioflow-media-')
  );
  const extension = extname(options.media.fileName).slice(0, 16);
  const temporaryPath = join(temporaryDirectory, `source${extension}`);

  try {
    await pipeline(source.stream, createWriteStream(temporaryPath));
    return await uploadFile(temporaryPath, options);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function createGeminiMediaPart(options: GeminiMediaResolverOptions): Promise<Part> {
  const source =
    options.source ||
    (options.media.uri ? ({ kind: 'uri', uri: options.media.uri } as const) : undefined);

  if (!source) {
    throw new Error('Media must provide a URI, file path, Blob, or readable stream.');
  }

  if (source.kind === 'uri') {
    return createPartFromUri(source.uri, options.media.mimeType);
  }

  if (source.kind === 'stream') {
    return uploadStream(source, options);
  }

  return uploadFile(source.kind === 'path' ? source.path : source.blob, options);
}
