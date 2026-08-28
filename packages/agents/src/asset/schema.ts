import { Type } from '@google/genai';

export const ASSET_ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    mediaProperties: {
      type: Type.OBJECT,
      properties: {
        aspectRatio: { type: Type.STRING },
        resolution: { type: Type.STRING },
        visualStyle: { type: Type.STRING },
        dominantColors: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['aspectRatio', 'resolution', 'visualStyle', 'dominantColors'],
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSeconds: { type: Type.NUMBER },
          endSeconds: { type: Type.NUMBER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          environment: { type: Type.STRING },
          shotType: { type: Type.STRING },
          lighting: { type: Type.STRING },
          motion: { type: Type.STRING },
          tone: {
            type: Type.STRING,
            enum: ['violet', 'cyan', 'amber', 'rose'],
          },
          objects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                category: { type: Type.STRING },
                confidence: { type: Type.INTEGER },
              },
              required: ['label', 'category', 'confidence'],
            },
          },
          branding: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedUse: { type: Type.STRING },
        },
        required: [
          'startSeconds',
          'endSeconds',
          'title',
          'description',
          'environment',
          'shotType',
          'lighting',
          'motion',
          'tone',
          'objects',
          'branding',
          'recommendedUse',
        ],
      },
    },
    objectTags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'mediaProperties', 'scenes', 'objectTags'],
};
