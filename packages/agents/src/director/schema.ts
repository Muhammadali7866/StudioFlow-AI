import { Type } from '@google/genai';

export const WORKFLOW_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'A concise explanation of the workflow strategy.',
    },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          agent: {
            type: Type.STRING,
            enum: ['transcript', 'asset', 'compliance', 'publisher'],
          },
          action: { type: Type.STRING },
          description: { type: Type.STRING },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          expectedOutput: { type: Type.STRING },
        },
        required: ['id', 'agent', 'action', 'description', 'dependsOn', 'expectedOutput'],
      },
    },
  },
  required: ['summary', 'tasks'],
};
