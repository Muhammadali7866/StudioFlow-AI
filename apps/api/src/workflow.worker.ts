import {
  AssetAgent,
  ComplianceAgent,
  PublisherAgent,
  TranscriptAgent,
} from '@studioflow/agents';
import { WorkflowState } from '@studioflow/shared';
import { agentExecutionService, AgentExecutionService } from './services/agent-execution.service';
import { WorkflowEvent } from './services/pubsub-events';
import { pubSubService, PubSubService } from './services/pubsub.service';
import { WorkflowService, workflowService } from './services/workflow.service';

export interface WorkflowWorkerOptions {
  pubSubService?: PubSubService;
  workflowService?: WorkflowService;
  agentExecutionService?: AgentExecutionService;
}

export class WorkflowWorker {
  private readonly pubSub: PubSubService;
  private readonly workflows: WorkflowService;
  private readonly execution: AgentExecutionService;
  private unsubscribe?: () => Promise<void>;

  private readonly transcriptAgent: TranscriptAgent;
  private readonly assetAgent: AssetAgent;
  private readonly complianceAgent: ComplianceAgent;
  private readonly publisherAgent: PublisherAgent;

  constructor(options: WorkflowWorkerOptions = {}) {
    this.pubSub = options.pubSubService || pubSubService;
    this.workflows = options.workflowService || workflowService;
    this.execution = options.agentExecutionService || agentExecutionService;

    this.transcriptAgent = new TranscriptAgent();
    this.assetAgent = new AssetAgent();
    this.complianceAgent = new ComplianceAgent();
    this.publisherAgent = new PublisherAgent();
  }

  public async start(): Promise<void> {
    if (this.unsubscribe) return;
    this.unsubscribe = await this.pubSub.subscribeWorkflowEvents((event) =>
      this.handleEvent(event)
    );
  }

  public async stop(): Promise<void> {
    if (this.unsubscribe) {
      await this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  public async handleEvent(event: WorkflowEvent): Promise<void> {
    if (event.eventType === 'WorkflowStarted') {
      await this.processWorkflow(event.workflowId, event.projectId, event.mediaId);
    }
  }

  public async processWorkflow(
    workflowId: string,
    projectId: string,
    mediaId?: string
  ): Promise<void> {
    const workflow = await this.workflows.getWorkflow(workflowId);
    if (!workflow || workflow.status === 'COMPLETED' || workflow.status === 'FAILED') {
      return;
    }

    if (workflow.status === 'CREATED') {
      await this.workflows.transitionWorkflow(workflowId, 'PROCESSING');
    }

    const defaultMedia = {
      id: mediaId || 'media-default',
      fileName: 'media-asset.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1024 * 1024,
      durationSeconds: 120,
    };

    let transcriptResult: Record<string, unknown> | undefined;
    let assetResult: Record<string, unknown> | undefined;
    let complianceResult: Record<string, unknown> | undefined;

    // Process tasks in task list
    for (const task of workflow.tasks) {
      if (task.status === 'completed') continue;

      const agentName = task.agentName.toLowerCase();

      try {
        if (agentName === 'transcript') {
          await this.transitionStateIfAllowed(workflowId, 'TRANSCRIBING');
          transcriptResult = await this.execution.executeTask(
            workflowId,
            task.id,
            async () => {
              const res = await this.transcriptAgent.analyze({
                projectId,
                media: defaultMedia,
              });
              return res as unknown as Record<string, unknown>;
            }
          );
        } else if (agentName === 'asset') {
          await this.transitionStateIfAllowed(workflowId, 'ANALYZING_ASSETS');
          assetResult = await this.execution.executeTask(workflowId, task.id, async () => {
            const res = await this.assetAgent.analyze({
              projectId,
              media: defaultMedia,
            });
            return res as unknown as Record<string, unknown>;
          });
        } else if (agentName === 'compliance') {
          await this.transitionStateIfAllowed(workflowId, 'CHECKING_COMPLIANCE');
          complianceResult = await this.execution.executeTask(
            workflowId,
            task.id,
            async () => {
              const res = await this.complianceAgent.analyze({
                projectId,
                media: defaultMedia,
                transcriptResult: transcriptResult as any,
                assetResult: assetResult as any,
              });
              return res as unknown as Record<string, unknown>;
            }
          );
        } else if (agentName === 'publisher') {
          await this.transitionStateIfAllowed(workflowId, 'GENERATING_PUBLISHING_PACKAGE');
          await this.execution.executeTask(workflowId, task.id, async () => {
            const res = await this.publisherAgent.analyze({
              projectId,
              media: defaultMedia,
              transcriptResult: transcriptResult as any,
              assetResult: assetResult as any,
              complianceResult: complianceResult as any,
            });
            return res as unknown as Record<string, unknown>;
          });
        } else {
          // General / custom agent task execution
          await this.execution.executeTask(workflowId, task.id, async () => {
            return { result: `Executed task ${task.action}` };
          });
        }
      } catch (error) {
        console.warn(`⚠️ [WorkflowWorker] Task ${task.id} failed:`, error);
        return; // Stop processing further tasks on failure
      }
    }

    // Final workflow state transitions
    await this.transitionStateIfAllowed(workflowId, 'REVIEW');
  }

  private async transitionStateIfAllowed(
    workflowId: string,
    targetState: WorkflowState
  ): Promise<void> {
    try {
      const current = await this.workflows.getWorkflow(workflowId);
      if (current && current.status !== targetState && current.status !== 'FAILED') {
        await this.workflows.transitionWorkflow(workflowId, targetState);
      }
    } catch (error) {
      console.warn(`⚠️ [WorkflowWorker] Ignored state transition error to ${targetState}:`, error);
    }
  }
}

export const workflowWorker = new WorkflowWorker();
