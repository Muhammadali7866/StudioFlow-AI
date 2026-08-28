import type {
  TranscriptAnalysisResult,
  TranscriptChapter,
  TranscriptPanelData,
  TranscriptRequest,
  TranscriptSegment,
  TranscriptSpeaker,
} from './types';

export interface TranscriptChunkResult {
  language: string;
  summary: string;
  transcript: Array<Omit<TranscriptSegment, 'id' | 'timestamp' | 'flagged'>>;
  chapters: Array<Omit<TranscriptChapter, 'id' | 'timestamp'>>;
  speakers: Array<Omit<TranscriptSpeaker, 'id'>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }

  return value;
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

export function formatTranscriptTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function parseTranscriptSegment(
  value: unknown,
  index: number,
  offsetSeconds: number
): Omit<TranscriptSegment, 'id' | 'timestamp' | 'flagged'> {
  if (!isRecord(value)) {
    throw new Error(`transcript[${index}] must be an object.`);
  }

  const relativeStart = Math.max(
    0,
    requireNumber(value.startSeconds, `transcript[${index}].startSeconds`)
  );
  const relativeEnd = Math.max(
    relativeStart,
    requireNumber(value.endSeconds, `transcript[${index}].endSeconds`)
  );
  const confidence = Math.round(
    Math.min(100, Math.max(0, requireNumber(value.confidence, `transcript[${index}].confidence`)))
  );

  return {
    startSeconds: relativeStart + offsetSeconds,
    endSeconds: relativeEnd + offsetSeconds,
    speaker: requireString(value.speaker, `transcript[${index}].speaker`),
    text: requireString(value.text, `transcript[${index}].text`),
    confidence,
  };
}

function parseChapter(
  value: unknown,
  index: number,
  offsetSeconds: number
): Omit<TranscriptChapter, 'id' | 'timestamp'> {
  if (!isRecord(value)) {
    throw new Error(`chapters[${index}] must be an object.`);
  }

  return {
    startSeconds:
      Math.max(0, requireNumber(value.startSeconds, `chapters[${index}].startSeconds`)) +
      offsetSeconds,
    title: requireString(value.title, `chapters[${index}].title`),
    summary: requireString(value.summary, `chapters[${index}].summary`),
  };
}

function parseSpeaker(value: unknown, index: number): Omit<TranscriptSpeaker, 'id'> {
  if (!isRecord(value)) {
    throw new Error(`speakers[${index}] must be an object.`);
  }

  return {
    label: requireString(value.label, `speakers[${index}].label`),
    description: requireString(value.description, `speakers[${index}].description`),
  };
}

export function parseTranscriptChunkResponse(
  responseText: string,
  offsetSeconds = 0
): TranscriptChunkResult {
  const parsed: unknown = JSON.parse(unwrapJson(responseText));

  if (!isRecord(parsed)) {
    throw new Error('Gemini transcript response must be an object.');
  }

  if (!Array.isArray(parsed.transcript) || parsed.transcript.length === 0) {
    throw new Error('Gemini transcript response must contain transcript segments.');
  }

  if (!Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
    throw new Error('Gemini transcript response must contain chapters.');
  }

  if (!Array.isArray(parsed.speakers)) {
    throw new Error('Gemini transcript response must contain a speakers array.');
  }

  return {
    language: requireString(parsed.language, 'language'),
    summary: requireString(parsed.summary, 'summary'),
    transcript: parsed.transcript.map((segment, index) =>
      parseTranscriptSegment(segment, index, offsetSeconds)
    ),
    chapters: parsed.chapters.map((chapter, index) => parseChapter(chapter, index, offsetSeconds)),
    speakers: parsed.speakers.map(parseSpeaker),
  };
}

function deduplicateBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = keyFor(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeTranscriptChunks(
  request: TranscriptRequest,
  chunks: TranscriptChunkResult[],
  generatedAt: string
): TranscriptAnalysisResult {
  const rawSegments = deduplicateBy(
    chunks.flatMap((chunk) => chunk.transcript).sort((a, b) => a.startSeconds - b.startSeconds),
    (segment) => `${segment.startSeconds}:${segment.speaker}:${segment.text}`
  );
  const rawChapters = deduplicateBy(
    chunks.flatMap((chunk) => chunk.chapters).sort((a, b) => a.startSeconds - b.startSeconds),
    (chapter) => `${chapter.startSeconds}:${chapter.title}`
  );
  const rawSpeakers = deduplicateBy(
    chunks.flatMap((chunk) => chunk.speakers),
    (speaker) => speaker.label
  );

  for (const segment of rawSegments) {
    if (
      !rawSpeakers.some((speaker) => speaker.label.toLowerCase() === segment.speaker.toLowerCase())
    ) {
      rawSpeakers.push({
        label: segment.speaker,
        description: 'Speaker identified in transcript.',
      });
    }
  }

  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    language: chunks[0]?.language || request.languageHint || 'undetermined',
    transcript: rawSegments.map((segment, index) => ({
      ...segment,
      id: `segment-${index + 1}`,
      timestamp: formatTranscriptTimestamp(segment.startSeconds),
      flagged: segment.confidence < 70 || undefined,
    })),
    summary: chunks.map((chunk) => chunk.summary).join(' '),
    chapters: rawChapters.map((chapter, index) => ({
      ...chapter,
      id: `chapter-${index + 1}`,
      timestamp: formatTranscriptTimestamp(chapter.startSeconds),
    })),
    speakers: rawSpeakers.map((speaker, index) => ({
      ...speaker,
      id: `speaker-${index + 1}`,
    })),
    source: 'gemini',
    generatedAt,
  };
}

export function createFallbackTranscriptResult(
  request: TranscriptRequest,
  generatedAt: string
): TranscriptAnalysisResult {
  const speaker = 'Unidentified audio';

  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    language: request.languageHint || 'undetermined',
    transcript: [
      {
        id: 'segment-1',
        startSeconds: 0,
        endSeconds: 0,
        timestamp: '00:00',
        speaker,
        text: `Automated transcription is unavailable for ${request.media.fileName}.`,
        confidence: 0,
        flagged: true,
      },
    ],
    summary: 'Transcript generation requires a configured Gemini client and accessible media.',
    chapters: [
      {
        id: 'chapter-1',
        startSeconds: 0,
        timestamp: '00:00',
        title: 'Media start',
        summary: 'Transcript and chapter details are awaiting media analysis.',
      },
    ],
    speakers: [
      {
        id: 'speaker-1',
        label: speaker,
        description: 'Speaker details are awaiting media analysis.',
      },
    ],
    source: 'fallback',
    generatedAt,
  };
}

export function toTranscriptPanelData(result: TranscriptAnalysisResult): TranscriptPanelData {
  return {
    segments: result.transcript.map(({ id, timestamp, speaker, text, confidence, flagged }) => ({
      id,
      timestamp,
      speaker,
      text,
      confidence,
      ...(flagged ? { flagged } : {}),
    })),
    chapters: result.chapters.map(({ id, timestamp, title, summary }) => ({
      id,
      timestamp,
      title,
      summary,
    })),
  };
}
