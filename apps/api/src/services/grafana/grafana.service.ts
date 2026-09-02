import { Attributes, Counter, Histogram, Meter } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { env } from '@studioflow/config';
import { AgentTelemetryClient, AgentTelemetryEvent } from './types';

const SERVICE_NAME = 'studioflow-api';
const SERVICE_VERSION = '0.1.0';

export interface GrafanaTelemetryConfig {
  endpoint?: string;
  metricsEndpoint?: string;
  headers?: string;
  cloudInstanceId?: string;
  cloudApiKey?: string;
  exportIntervalMs: number;
  exportTimeoutMs: number;
  environment: string;
}

interface MetricProvider {
  getMeter(name: string, version?: string): Meter;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface GrafanaServiceOptions {
  config?: GrafanaTelemetryConfig;
  meterProvider?: MetricProvider;
  ownsMeterProvider?: boolean;
}

export function resolveMetricsEndpoint(
  endpoint: string | undefined,
  metricsEndpoint?: string
): string | undefined {
  if (metricsEndpoint?.trim()) return metricsEndpoint.trim();
  if (!endpoint?.trim()) return undefined;

  const base = endpoint.trim().replace(/\/+$/, '');
  return base.endsWith('/v1/metrics') ? base : `${base}/v1/metrics`;
}

export function parseOtlpHeaders(serializedHeaders?: string): Record<string, string> {
  if (!serializedHeaders?.trim()) return {};

  return serializedHeaders.split(',').reduce<Record<string, string>>((headers, entry) => {
    const separator = entry.indexOf('=');
    if (separator < 1) return headers;

    const key = safelyDecodeHeaderPart(entry.slice(0, separator).trim());
    const value = safelyDecodeHeaderPart(entry.slice(separator + 1).trim());
    if (key && value) headers[key] = value;
    return headers;
  }, {});
}

function safelyDecodeHeaderPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function createOtlpHeaders(config: GrafanaTelemetryConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.cloudInstanceId && config.cloudApiKey) {
    const credentials = Buffer.from(
      `${config.cloudInstanceId}:${config.cloudApiKey}`,
      'utf8'
    ).toString('base64');
    headers.Authorization = `Basic ${credentials}`;
  }

  return { ...headers, ...parseOtlpHeaders(config.headers) };
}

export function grafanaConfigFromEnvironment(): GrafanaTelemetryConfig {
  return {
    endpoint: env.otelExporterOtlpEndpoint,
    metricsEndpoint: env.otelExporterOtlpMetricsEndpoint,
    headers: env.otelExporterOtlpHeaders,
    cloudInstanceId: env.grafanaCloudInstanceId,
    cloudApiKey: env.grafanaCloudApiKey,
    exportIntervalMs: env.grafanaMetricsExportIntervalMs,
    exportTimeoutMs: env.grafanaMetricsExportTimeoutMs,
    environment: env.nodeEnv,
  };
}

export class GrafanaService implements AgentTelemetryClient {
  private readonly provider?: MetricProvider;
  private readonly ownsProvider: boolean;
  private readonly executions?: Counter;
  private readonly failures?: Counter;
  private readonly retries?: Counter;
  private readonly agentDuration?: Histogram;
  private readonly workflowStepDuration?: Histogram;
  private readonly geminiLatency?: Histogram;

  constructor(options: GrafanaServiceOptions = {}) {
    const config = options.config || grafanaConfigFromEnvironment();
    const endpoint = resolveMetricsEndpoint(config.endpoint, config.metricsEndpoint);
    let provider: MetricProvider | undefined;
    let ownsProvider = false;

    if (options.meterProvider) {
      provider = options.meterProvider;
      ownsProvider = options.ownsMeterProvider ?? false;
    } else if (endpoint) {
      try {
        const exportTimeoutMs = Math.min(config.exportTimeoutMs, config.exportIntervalMs);
        const exporter = new OTLPMetricExporter({
          url: endpoint,
          headers: createOtlpHeaders(config),
          timeoutMillis: exportTimeoutMs,
        });
        const reader = new PeriodicExportingMetricReader({
          exporter,
          exportIntervalMillis: config.exportIntervalMs,
          exportTimeoutMillis: exportTimeoutMs,
        });
        provider = new MeterProvider({
          resource: resourceFromAttributes({
            'service.name': SERVICE_NAME,
            'service.version': SERVICE_VERSION,
            'deployment.environment.name': config.environment,
          }),
          readers: [reader],
        });
        ownsProvider = true;
      } catch {
        // Invalid telemetry configuration must not prevent the API from starting.
      }
    }

    this.provider = provider;
    this.ownsProvider = ownsProvider;
    if (!this.provider) return;

    const meter = this.provider.getMeter('studioflow.agent-workflows', SERVICE_VERSION);
    this.executions = meter.createCounter('studioflow.agent.executions', {
      description: 'Number of agent execution attempts',
      unit: '{attempt}',
    });
    this.failures = meter.createCounter('studioflow.agent.failures', {
      description: 'Number of failed agent execution attempts',
      unit: '{failure}',
    });
    this.retries = meter.createCounter('studioflow.agent.retries', {
      description: 'Number of agent retries scheduled',
      unit: '{retry}',
    });
    this.agentDuration = meter.createHistogram('studioflow.agent.duration', {
      description: 'End-to-end agent attempt duration',
      unit: 'ms',
    });
    this.workflowStepDuration = meter.createHistogram('studioflow.workflow.step.duration', {
      description: 'Workflow task attempt duration',
      unit: 'ms',
    });
    this.geminiLatency = meter.createHistogram('studioflow.gemini.latency', {
      description: 'Latency of the agent model operation',
      unit: 'ms',
    });
  }

  public recordAgentAttempt(event: AgentTelemetryEvent): void {
    if (!this.provider) return;

    try {
      const attributes: Attributes = {
        workflowId: event.workflowId,
        agentType: event.agentType,
        attempt: event.attempt,
        status: event.status,
      };
      if (event.errorCode) attributes.errorCode = event.errorCode;

      const durationMs = this.nonNegativeMeasurement(event.durationMs);
      const geminiLatency = this.nonNegativeMeasurement(event.geminiLatency);
      this.executions?.add(1, attributes);
      this.agentDuration?.record(durationMs, attributes);
      this.workflowStepDuration?.record(durationMs, attributes);
      this.geminiLatency?.record(geminiLatency, attributes);

      if (event.status === 'failed') this.failures?.add(1, attributes);
      if (event.retryScheduled) this.retries?.add(1, attributes);
    } catch {
      // Telemetry must never interrupt workflow execution.
    }
  }

  public async forceFlush(): Promise<boolean> {
    if (!this.provider) return false;

    try {
      await this.provider.forceFlush();
      return true;
    } catch {
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.provider || !this.ownsProvider) return;

    try {
      await this.provider.shutdown();
    } catch {
      // The API can shut down even when the telemetry backend is unavailable.
    }
  }

  public isEnabled(): boolean {
    return Boolean(this.provider);
  }

  private nonNegativeMeasurement(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
}

export const grafanaService = new GrafanaService();
