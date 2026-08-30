import { Type } from '@google/genai';

const COMPLIANCE_CHECK_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    status: { type: Type.STRING },
    resolution: { type: Type.STRING },
    resolved: { type: Type.BOOLEAN },
  },
  required: ['category', 'title', 'description', 'status', 'resolution', 'resolved'],
};

export const COMPLIANCE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallStatus: { type: Type.STRING },
    summary: { type: Type.STRING },
    checks: {
      type: Type.ARRAY,
      items: COMPLIANCE_CHECK_ITEM_SCHEMA,
    },
  },
  required: ['overallStatus', 'summary', 'checks'],
};
