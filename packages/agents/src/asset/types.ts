import type { MediaMetadata } from '../director/types';
import type { GeminiMediaSource } from '../media/types';

export type AssetMediaSource = GeminiMediaSource;
export type AssetSceneTone = 'violet' | 'cyan' | 'amber' | 'rose';

export interface AssetAnalysisRequest {
  projectId: string;
  media: MediaMetadata;
  source?: AssetMediaSource;
}

export interface AssetMediaProperties {
  aspectRatio: string;
  resolution: string;
  visualStyle: string;
  dominantColors: string[];
}

export interface DetectedVisualObject {
  label: string;
  category: string;
  confidence: number;
}

export interface AssetScene {
  id: string;
  startSeconds: number;
  endSeconds: number;
  timestamp: string;
  title: string;
  description: string;
  environment: string;
  shotType: string;
  lighting: string;
  motion: string;
  tone: AssetSceneTone;
  objects: DetectedVisualObject[];
  branding: string[];
  recommendedUse: string;
}

export interface AssetAnalysisResult {
  projectId: string;
  mediaId: string;
  summary: string;
  mediaProperties: AssetMediaProperties;
  scenes: AssetScene[];
  objectTags: string[];
  branding: string[];
  source: 'gemini' | 'fallback';
  generatedAt: string;
}

export interface ScenePanelData {
  scenes: Array<{
    id: string;
    timestamp: string;
    title: string;
    summary: string;
    signals: string[];
    artworkTone: AssetSceneTone;
    recommendedUse: string;
  }>;
}
