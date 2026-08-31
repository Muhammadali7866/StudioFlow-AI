import {
  createPartFromText,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import { env } from '@studioflow/config';
import { validateMediaJob } from '../director/workflow-plan';
import { buildCompliancePrompt, COMPLIANCE_SYSTEM_INSTRUCTION } from './prompt';
import { COMPLIANCE_RESPONSE_SCHEMA } from './schema';
import {
  createFallbackComplianceResult,
  parseComplianceResponse,
} from './compliance-result';
import type { ComplianceAnalysisResult, ComplianceRequest } from './types';

export interface ComplianceAgentOptions {
  aiClient?: GoogleGenAI | null;
  now?: () => Date;
}

export class ComplianceAgent {
  private readonly aiClient?: GoogleGenAI;
  private readonly now: () => Date;

  constructor(options: ComplianceAgentOptions = {}) {
    this.now = options.now || (() => new Date());

    if (options.aiClient !== undefined) {
      this.aiClient = options.aiClient || undefined;
      return;
    }

    if (env.geminiApiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
      } catch (error) {
        console.warn('⚠️ [ComplianceAgent] Failed to initialize GoogleGenAI client:', error);
      }
    }
  }

  public async analyze(request: ComplianceRequest): Promise<ComplianceAnalysisResult> {
    this.validateRequest(request);
    const generatedAt = this.now().toISOString();

    if (!this.aiClient) {
      return createFallbackComplianceResult(request, generatedAt);
    }

    try {
      const prompt = buildCompliancePrompt(request);

      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: COMPLIANCE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: COMPLIANCE_RESPONSE_SCHEMA,
        },
        contents: createUserContent([createPartFromText(prompt)]),
      });

      const parsed = parseComplianceResponse(response.text ?? '');

      return {
        projectId: request.projectId,
        mediaId: request.media.id,
        overallStatus: parsed.overallStatus,
        summary: parsed.summary,
        checks: parsed.checks,
        source: 'gemini',
        generatedAt,
      };
    } catch (error) {
      console.warn('⚠️ [ComplianceAgent] Falling back to unavailable compliance result:', error);
      return createFallbackComplianceResult(request, generatedAt);
    }
  }

  private validateRequest(request: ComplianceRequest): void {
    validateMediaJob({
      projectId: request.projectId,
      objective: 'Perform publishing readiness compliance audit.',
      media: request.media,
    });
  }
}
