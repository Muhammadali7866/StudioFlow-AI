import { Type } from '@google/genai';

export const TRANSCRIPT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    summary: { type: Type.STRING },
    transcript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSeconds: { type: Type.NUMBER },
          endSeconds: { type: Type.NUMBER },
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          confidence: { type: Type.INTEGER },
        },
        required: ['startSeconds', 'endSeconds', 'speaker', 'text', 'confidence'],
      },
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSeconds: { type: Type.NUMBER },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['startSeconds', 'title', 'summary'],
      },
    },
    speakers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['label', 'description'],
      },
    },
  },
  required: ['language', 'summary', 'transcript', 'chapters', 'speakers'],
};
