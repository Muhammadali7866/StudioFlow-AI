import {
  MediaJob,
  SPECIALIST_AGENT_NAMES,
  SpecialistAgentName,
  WorkflowPlan,
  WorkflowTask,
} from './types';

interface WorkflowPlanDraft {
  summary: string;
  tasks: WorkflowTask[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSpecialistAgentName(value: unknown): value is SpecialistAgentName {
  return typeof value === 'string' && SPECIALIST_AGENT_NAMES.includes(value as SpecialistAgentName);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

export function validateMediaJob(job: MediaJob): void {
  requireNonEmptyString(job.projectId, 'projectId');
  requireNonEmptyString(job.objective, 'objective');

  if (!isRecord(job.media)) {
    throw new Error('media must be provided.');
  }

  requireNonEmptyString(job.media.id, 'media.id');
  requireNonEmptyString(job.media.fileName, 'media.fileName');
  const mimeType = requireNonEmptyString(job.media.mimeType, 'media.mimeType');

  if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
    throw new Error('media.mimeType must describe audio or video media.');
  }

  if (!Number.isFinite(job.media.sizeBytes) || job.media.sizeBytes < 0) {
    throw new Error('media.sizeBytes must be a non-negative number.');
  }

  if (
    job.media.durationSeconds !== undefined &&
    (!Number.isFinite(job.media.durationSeconds) || job.media.durationSeconds <= 0)
  ) {
    throw new Error('media.durationSeconds must be a positive number when provided.');
  }
}

export function buildExecutionOrder(tasks: WorkflowTask[]): string[][] {
  const taskIds = new Set(tasks.map((task) => task.id));

  if (taskIds.size !== tasks.length) {
    throw new Error('Workflow task IDs must be unique.');
  }

  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) {
        throw new Error(`Task ${task.id} depends on unknown task ${dependency}.`);
      }

      if (dependency === task.id) {
        throw new Error(`Task ${task.id} cannot depend on itself.`);
      }
    }
  }

  const completed = new Set<string>();
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const executionOrder: string[][] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((task) => task.dependsOn.every((dependency) => completed.has(dependency)))
      .map((task) => task.id);

    if (ready.length === 0) {
      throw new Error('Workflow task dependencies contain a cycle.');
    }

    executionOrder.push(ready);
    for (const taskId of ready) {
      completed.add(taskId);
      remaining.delete(taskId);
    }
  }

  return executionOrder;
}

function createAnalysisTasks(job: MediaJob): WorkflowTask[] {
  const tasks: WorkflowTask[] = [
    {
      id: 'transcript-analysis',
      agent: 'transcript',
      action: 'analyze-transcript',
      description: 'Generate the transcript, speakers, summary, and timestamped chapters.',
      dependsOn: [],
      expectedOutput: 'TranscriptAnalysisResult',
    },
  ];

  if (job.media.mimeType.startsWith('video/')) {
    tasks.push({
      id: 'asset-analysis',
      agent: 'asset',
      action: 'analyze-visual-assets',
      description: 'Analyze scenes, visual properties, branding, and key object tags.',
      dependsOn: [],
      expectedOutput: 'AssetAnalysisResult',
    });
  }

  return tasks;
}

export function createFallbackWorkflowPlan(
  job: MediaJob,
  createdAt = new Date().toISOString()
): WorkflowPlan {
  validateMediaJob(job);

  const tasks = createAnalysisTasks(job);
  const analysisTaskIds = tasks.map((task) => task.id);

  tasks.push(
    {
      id: 'compliance-review',
      agent: 'compliance',
      action: 'review-publishing-readiness',
      description: 'Review specialist outputs for safety, accessibility, and publishing readiness.',
      dependsOn: analysisTaskIds,
      expectedOutput: 'ComplianceAnalysisResult',
    },
    {
      id: 'publishing-package',
      agent: 'publisher',
      action: 'create-publishing-package',
      description: `Create the final metadata package for ${job.targetPlatform || 'the target platform'}.`,
      dependsOn: ['compliance-review'],
      expectedOutput: 'PublishingPackageResult',
    }
  );

  return {
    version: '1.0',
    projectId: job.projectId,
    objective: job.objective,
    media: { ...job.media },
    summary: 'Run media analysis in parallel, then complete compliance and publishing in order.',
    tasks,
    executionOrder: buildExecutionOrder(tasks),
    source: 'fallback',
    createdAt,
  };
}

function parseTask(value: unknown, index: number): WorkflowTask {
  if (!isRecord(value)) {
    throw new Error(`tasks[${index}] must be an object.`);
  }

  if (!isSpecialistAgentName(value.agent)) {
    throw new Error(`tasks[${index}].agent is not a supported specialist.`);
  }

  if (
    !Array.isArray(value.dependsOn) ||
    !value.dependsOn.every((item) => typeof item === 'string')
  ) {
    throw new Error(`tasks[${index}].dependsOn must be an array of task IDs.`);
  }

  return {
    id: requireNonEmptyString(value.id, `tasks[${index}].id`),
    agent: value.agent,
    action: requireNonEmptyString(value.action, `tasks[${index}].action`),
    description: requireNonEmptyString(value.description, `tasks[${index}].description`),
    dependsOn: value.dependsOn.map((dependency) => dependency.trim()),
    expectedOutput: requireNonEmptyString(value.expectedOutput, `tasks[${index}].expectedOutput`),
  };
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

export function parseWorkflowPlanResponse(text: string): WorkflowPlanDraft {
  const parsed: unknown = JSON.parse(unwrapJson(text));

  if (!isRecord(parsed) || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error('Gemini workflow response must contain at least one task.');
  }

  const draft = {
    summary: requireNonEmptyString(parsed.summary, 'summary'),
    tasks: parsed.tasks.map(parseTask),
  };

  buildExecutionOrder(draft.tasks);
  return draft;
}

export function createGeminiWorkflowPlan(
  job: MediaJob,
  responseText: string,
  createdAt = new Date().toISOString()
): WorkflowPlan {
  validateMediaJob(job);
  const draft = parseWorkflowPlanResponse(responseText);
  const requiredAgents: SpecialistAgentName[] = job.media.mimeType.startsWith('video/')
    ? ['transcript', 'asset', 'compliance', 'publisher']
    : ['transcript', 'compliance', 'publisher'];
  const plannedAgents = new Set(draft.tasks.map((task) => task.agent));

  for (const requiredAgent of requiredAgents) {
    if (!plannedAgents.has(requiredAgent)) {
      throw new Error(`Gemini workflow response is missing the ${requiredAgent} specialist.`);
    }
  }

  return {
    version: '1.0',
    projectId: job.projectId,
    objective: job.objective,
    media: { ...job.media },
    summary: draft.summary,
    tasks: draft.tasks,
    executionOrder: buildExecutionOrder(draft.tasks),
    source: 'gemini',
    createdAt,
  };
}
