import { Type } from '@google/genai';

const PLATFORM_METADATA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    platform: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    callToAction: { type: Type.STRING },
    chapterMarkers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['platform', 'title', 'description', 'hashtags'],
};

export const PUBLISHER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    platforms: {
      type: Type.ARRAY,
      items: PLATFORM_METADATA_SCHEMA,
    },
  },
  required: ['summary', 'platforms'],
};
