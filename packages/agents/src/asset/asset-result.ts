import type {
  AssetAnalysisRequest,
  AssetAnalysisResult,
  AssetMediaProperties,
  AssetScene,
  AssetSceneTone,
  DetectedVisualObject,
  ScenePanelData,
} from './types';

export interface AssetChunkResult {
  summary: string;
  mediaProperties: AssetMediaProperties;
  scenes: Array<Omit<AssetScene, 'id' | 'timestamp'>>;
  objectTags: string[];
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

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${field} must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

function isSceneTone(value: unknown): value is AssetSceneTone {
  return value === 'violet' || value === 'cyan' || value === 'amber' || value === 'rose';
}

export function formatAssetTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function parseMediaProperties(value: unknown): AssetMediaProperties {
  if (!isRecord(value)) {
    throw new Error('mediaProperties must be an object.');
  }

  return {
    aspectRatio: requireString(value.aspectRatio, 'mediaProperties.aspectRatio'),
    resolution: requireString(value.resolution, 'mediaProperties.resolution'),
    visualStyle: requireString(value.visualStyle, 'mediaProperties.visualStyle'),
    dominantColors: requireStringArray(value.dominantColors, 'mediaProperties.dominantColors'),
  };
}

function parseObject(
  value: unknown,
  sceneIndex: number,
  objectIndex: number
): DetectedVisualObject {
  if (!isRecord(value)) {
    throw new Error(`scenes[${sceneIndex}].objects[${objectIndex}] must be an object.`);
  }

  return {
    label: requireString(value.label, `scenes[${sceneIndex}].objects[${objectIndex}].label`),
    category: requireString(
      value.category,
      `scenes[${sceneIndex}].objects[${objectIndex}].category`
    ),
    confidence: Math.round(
      Math.min(
        100,
        Math.max(
          0,
          requireNumber(
            value.confidence,
            `scenes[${sceneIndex}].objects[${objectIndex}].confidence`
          )
        )
      )
    ),
  };
}

function parseScene(
  value: unknown,
  index: number,
  offsetSeconds: number
): Omit<AssetScene, 'id' | 'timestamp'> {
  if (!isRecord(value)) {
    throw new Error(`scenes[${index}] must be an object.`);
  }

  if (!Array.isArray(value.objects)) {
    throw new Error(`scenes[${index}].objects must be an array.`);
  }

  if (!isSceneTone(value.tone)) {
    throw new Error(`scenes[${index}].tone is not supported.`);
  }

  const relativeStart = Math.max(
    0,
    requireNumber(value.startSeconds, `scenes[${index}].startSeconds`)
  );
  const relativeEnd = Math.max(
    relativeStart,
    requireNumber(value.endSeconds, `scenes[${index}].endSeconds`)
  );

  return {
    startSeconds: relativeStart + offsetSeconds,
    endSeconds: relativeEnd + offsetSeconds,
    title: requireString(value.title, `scenes[${index}].title`),
    description: requireString(value.description, `scenes[${index}].description`),
    environment: requireString(value.environment, `scenes[${index}].environment`),
    shotType: requireString(value.shotType, `scenes[${index}].shotType`),
    lighting: requireString(value.lighting, `scenes[${index}].lighting`),
    motion: requireString(value.motion, `scenes[${index}].motion`),
    tone: value.tone,
    objects: value.objects.map((item, objectIndex) => parseObject(item, index, objectIndex)),
    branding: requireStringArray(value.branding, `scenes[${index}].branding`),
    recommendedUse: requireString(value.recommendedUse, `scenes[${index}].recommendedUse`),
  };
}

export function parseAssetChunkResponse(responseText: string, offsetSeconds = 0): AssetChunkResult {
  const parsed: unknown = JSON.parse(unwrapJson(responseText));

  if (!isRecord(parsed)) {
    throw new Error('Gemini asset response must be an object.');
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('Gemini asset response must contain scenes.');
  }

  return {
    summary: requireString(parsed.summary, 'summary'),
    mediaProperties: parseMediaProperties(parsed.mediaProperties),
    scenes: parsed.scenes.map((scene, index) => parseScene(scene, index, offsetSeconds)),
    objectTags: requireStringArray(parsed.objectTags, 'objectTags'),
  };
}

function deduplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeAssetChunks(
  request: AssetAnalysisRequest,
  chunks: AssetChunkResult[],
  generatedAt: string
): AssetAnalysisResult {
  const seenScenes = new Set<string>();
  const rawScenes = chunks
    .flatMap((chunk) => chunk.scenes)
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .filter((scene) => {
      const key = `${scene.startSeconds}:${scene.title}`.toLowerCase();
      if (seenScenes.has(key)) return false;
      seenScenes.add(key);
      return true;
    });
  const mediaProperties = chunks[0]?.mediaProperties || {
    aspectRatio: 'unknown',
    resolution: 'unknown',
    visualStyle: 'unknown',
    dominantColors: [],
  };
  const objectTags = deduplicateStrings([
    ...chunks.flatMap((chunk) => chunk.objectTags),
    ...rawScenes.flatMap((scene) => scene.objects.map((object) => object.label)),
  ]);
  const branding = deduplicateStrings(rawScenes.flatMap((scene) => scene.branding));

  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    summary: chunks.map((chunk) => chunk.summary).join(' '),
    mediaProperties: {
      ...mediaProperties,
      dominantColors: deduplicateStrings(
        chunks.flatMap((chunk) => chunk.mediaProperties.dominantColors)
      ),
    },
    scenes: rawScenes.map((scene, index) => ({
      ...scene,
      id: `scene-${index + 1}`,
      timestamp: formatAssetTimestamp(scene.startSeconds),
    })),
    objectTags,
    branding,
    source: 'gemini',
    generatedAt,
  };
}

export function createFallbackAssetResult(
  request: AssetAnalysisRequest,
  generatedAt: string
): AssetAnalysisResult {
  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    summary: 'Visual asset analysis requires a configured Gemini client and accessible video.',
    mediaProperties: {
      aspectRatio: 'unknown',
      resolution: 'unknown',
      visualStyle: 'Analysis pending',
      dominantColors: [],
    },
    scenes: [
      {
        id: 'scene-1',
        startSeconds: 0,
        endSeconds: 0,
        timestamp: '00:00',
        title: 'Visual analysis pending',
        description: `Automated scene analysis is unavailable for ${request.media.fileName}.`,
        environment: 'Undetermined',
        shotType: 'Undetermined',
        lighting: 'Undetermined',
        motion: 'Undetermined',
        tone: 'rose',
        objects: [],
        branding: [],
        recommendedUse: 'Review required',
      },
    ],
    objectTags: [],
    branding: [],
    source: 'fallback',
    generatedAt,
  };
}

export function toScenePanelData(result: AssetAnalysisResult): ScenePanelData {
  return {
    scenes: result.scenes.map((scene) => ({
      id: scene.id,
      timestamp: scene.timestamp,
      title: scene.title,
      summary: scene.description,
      signals: deduplicateStrings([
        scene.shotType,
        scene.lighting,
        scene.motion,
        ...scene.objects.map((object) => object.label),
        ...scene.branding,
      ]).slice(0, 8),
      artworkTone: scene.tone,
      recommendedUse: scene.recommendedUse,
    })),
  };
}
