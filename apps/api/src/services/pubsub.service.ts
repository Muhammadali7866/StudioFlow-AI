import { Message, PubSub } from '@google-cloud/pubsub';
import { env } from '@studioflow/config';
import {
  WorkflowEvent,
  WorkflowStartedEvent,
} from './pubsub-events';

export interface PubSubServiceOptions {
  topicName?: string;
  subscriptionName?: string;
  pubsubClient?: PubSub;
}

export interface PubSubService {
  publishWorkflowStarted(workflowId: string, projectId: string, mediaId?: string): Promise<string>;
  publishEvent(event: WorkflowEvent): Promise<string>;
  subscribeWorkflowEvents(
    handler: (event: WorkflowEvent) => Promise<void>
  ): Promise<() => Promise<void>>;
  checkHealth(): Promise<boolean>;
}

export class CloudPubSubService implements PubSubService {
  private readonly pubsub: PubSub;
  private readonly topicName: string;
  private readonly subscriptionName: string;

  constructor(options: PubSubServiceOptions = {}) {
    this.topicName = options.topicName || process.env.PUBSUB_TOPIC_WORKFLOW_EVENTS || 'studioflow-workflow-events';
    this.subscriptionName =
      options.subscriptionName || process.env.PUBSUB_SUBSCRIPTION_WORKFLOW_EVENTS || 'studioflow-workflow-events-sub';

    if (options.pubsubClient) {
      this.pubsub = options.pubsubClient;
    } else {
      this.pubsub = new PubSub({
        projectId: env.googleCloudProjectId || 'studioflow-ai-dev',
      });
    }
  }

  public async publishWorkflowStarted(
    workflowId: string,
    projectId: string,
    mediaId?: string
  ): Promise<string> {
    const event: WorkflowStartedEvent = {
      eventType: 'WorkflowStarted',
      workflowId,
      projectId,
      ...(mediaId ? { mediaId } : {}),
      publishedAt: new Date().toISOString(),
    };
    return this.publishEvent(event);
  }

  public async publishEvent(event: WorkflowEvent): Promise<string> {
    const dataBuffer = Buffer.from(JSON.stringify(event));
    const topic = this.pubsub.topic(this.topicName);
    const messageId = await topic.publishMessage({ data: dataBuffer });
    return messageId;
  }

  public async subscribeWorkflowEvents(
    handler: (event: WorkflowEvent) => Promise<void>
  ): Promise<() => Promise<void>> {
    const subscription = this.pubsub.subscription(this.subscriptionName);

    const messageHandler = async (message: Message): Promise<void> => {
      try {
        const rawJson = message.data.toString('utf-8');
        const parsed = JSON.parse(rawJson) as WorkflowEvent;
        await handler(parsed);
        message.ack();
      } catch (error) {
        console.warn('⚠️ [PubSubService] Error processing event message:', error);
        message.nack();
      }
    };

    subscription.on('message', messageHandler);

    return async (): Promise<void> => {
      subscription.removeListener('message', messageHandler);
    };
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const topic = this.pubsub.topic(this.topicName);
      const [exists] = await topic.exists();
      return exists || Boolean(process.env.PUBSUB_EMULATOR_HOST);
    } catch {
      return false;
    }
  }
}

export class MemoryPubSubService implements PubSubService {
  private readonly events: WorkflowEvent[] = [];
  private readonly subscribers: Array<(event: WorkflowEvent) => Promise<void>> = [];

  public async publishWorkflowStarted(
    workflowId: string,
    projectId: string,
    mediaId?: string
  ): Promise<string> {
    const event: WorkflowStartedEvent = {
      eventType: 'WorkflowStarted',
      workflowId,
      projectId,
      ...(mediaId ? { mediaId } : {}),
      publishedAt: new Date().toISOString(),
    };
    return this.publishEvent(event);
  }

  public async publishEvent(event: WorkflowEvent): Promise<string> {
    this.events.push(structuredClone(event));
    const messageId = `mem_msg_${this.events.length}`;

    // Deliver async to subscribers
    for (const subscriber of this.subscribers) {
      setTimeout(async () => {
        try {
          await subscriber(structuredClone(event));
        } catch (error) {
          console.warn('⚠️ [MemoryPubSubService] Subscriber error:', error);
        }
      }, 0);
    }

    return messageId;
  }

  public async subscribeWorkflowEvents(
    handler: (event: WorkflowEvent) => Promise<void>
  ): Promise<() => Promise<void>> {
    this.subscribers.push(handler);

    return async (): Promise<void> => {
      const index = this.subscribers.indexOf(handler);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  public async checkHealth(): Promise<boolean> {
    return true;
  }

  public getPublishedEvents(): WorkflowEvent[] {
    return this.events.map((e) => structuredClone(e));
  }

  public clearEvents(): void {
    this.events.length = 0;
  }
}

// Select default implementation based on environment
const isTestOrDevWithoutGcp =
  process.env.NODE_ENV === 'test' ||
  (!env.geminiApiKey && !process.env.PUBSUB_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS);

export const pubSubService: PubSubService = isTestOrDevWithoutGcp
  ? new MemoryPubSubService()
  : new CloudPubSubService();
