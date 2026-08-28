import type { Readable } from 'node:stream';
import type { MediaMetadata } from '../director/types';

export type TranscriptMediaSource =
  | { kind: 'uri'; uri: string }
  | { kind: 'path'; path: string }
  | { kind: 'blob'; blob: Blob }
  | { kind: 'stream'; stream: Readable };

export interface TranscriptRequest {
  projectId: string;
  media: MediaMetadata;
  source?: TranscriptMediaSource;
  languageHint?: string;
}

export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  timestamp: string;
  speaker: string;
  text: string;
  confidence: number;
  flagged?: boolean;
}

export interface TranscriptChapter {
  id: string;
  startSeconds: number;
  timestamp: string;
  title: string;
  summary: string;
}

export interface TranscriptSpeaker {
  id: string;
  label: string;
  description: string;
}

export interface TranscriptAnalysisResult {
  projectId: string;
  mediaId: string;
  language: string;
  transcript: TranscriptSegment[];
  summary: string;
  chapters: TranscriptChapter[];
  speakers: TranscriptSpeaker[];
  source: 'gemini' | 'fallback';
  generatedAt: string;
}

export interface TranscriptPanelData {
  segments: Array<{
    id: string;
    timestamp: string;
    speaker: string;
    text: string;
    confidence: number;
    flagged?: boolean;
  }>;
  chapters: Array<{
    id: string;
    timestamp: string;
    title: string;
    summary: string;
  }>;
}
