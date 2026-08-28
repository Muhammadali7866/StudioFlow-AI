import { GoogleGenAI } from '@google/genai';
import { env } from '@studioflow/config';
import { buildDirectorPrompt, DIRECTOR_SYSTEM_INSTRUCTION } from './prompt';
import { WORKFLOW_PLAN_RESPONSE_SCHEMA } from './schema';
import {
  DelegationResult,
  MediaJob,
  SpecialistAgentName,
  SpecialistHandler,
  WorkflowPlan,
  WorkflowTask,
} from './types';
import {
  createFallbackWorkflowPlan,
  createGeminiWorkflowPlan,
  validateMediaJob,
} from './workflow-plan';

export interface DirectorAgentOptions {
  aiClient?: GoogleGenAI | null;
  handlers?: Partial<Record<SpecialistAgentName, SpecialistHandler>>;
  now?: () => Date;
}

export class DirectorAgent {
  private readonly aiClient?: GoogleGenAI;
  private readonly handlers = new Map<SpecialistAgentName, SpecialistHandler>();
  private readonly now: () => Date;

  constructor(options: DirectorAgentOptions = {}) {
    this.now = options.now || (() => new Date());

    for (const [agent, handler] of Object.entries(options.handlers || {})) {
      if (handler) {
        this.handlers.set(agent as SpecialistAgentName, handler);
      }
    }

    if (options.aiClient !== undefined) {
      this.aiClient = options.aiClient || undefined;
      return;
    }

    if (env.geminiApiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
      } catch (error) {
        console.warn('⚠️ [DirectorAgent] Failed to initialize GoogleGenAI client:', error);
      }
    }
  }

  public registerHandler(agent: SpecialistAgentName, handler: SpecialistHandler): void {
    this.handlers.set(agent, handler);
  }

  public async generatePlan(job: MediaJob): Promise<WorkflowPlan> {
    validateMediaJob(job);
    const createdAt = this.now().toISOString();

    if (!this.aiClient) {
      return createFallbackWorkflowPlan(job, createdAt);
    }

    try {
      const response = await this.aiClient.models.generateContent({
        model: env.geminiModel || 'gemini-2.5-flash',
        contents: buildDirectorPrompt(job),
        config: {
          systemInstruction: DIRECTOR_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: WORKFLOW_PLAN_RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      });

      if (!response.text) {
        throw new Error('Gemini returned an empty workflow response.');
      }

      return createGeminiWorkflowPlan(job, response.text, createdAt);
    } catch (error) {
      console.warn('⚠️ [DirectorAgent] Falling back to the deterministic workflow plan:', error);
      return createFallbackWorkflowPlan(job, createdAt);
    }
  }

  public getReadyTasks(plan: WorkflowPlan, completedTaskIds: Iterable<string>): WorkflowTask[] {
    const completed = new Set(completedTaskIds);

    return plan.tasks.filter(
      (task) =>
        !completed.has(task.id) && task.dependsOn.every((dependency) => completed.has(dependency))
    );
  }

  public async delegateTask(plan: WorkflowPlan, taskId: string): Promise<DelegationResult> {
    const task = plan.tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new Error(`Workflow task ${taskId} does not exist.`);
    }

    const handler = this.handlers.get(task.agent);

    if (!handler) {
      throw new Error(`No delegation handler is registered for ${task.agent}.`);
    }

    try {
      const output = await handler({ plan, task });
      return {
        taskId: task.id,
        agent: task.agent,
        status: 'completed',
        output,
      };
    } catch (error) {
      return {
        taskId: task.id,
        agent: task.agent,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const directorAgent = new DirectorAgent();
