import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  createOtlpHeaders,
  GrafanaService,
  parseOtlpHeaders,
  resolveMetricsEndpoint,
} from '../dist/services/grafana/index.js';

const testConfig = {
  exportIntervalMs: 60_000,
  exportTimeoutMs: 5_000,
  environment: 'test',
};

test('resolves Grafana Cloud and collector OTLP metrics endpoints', () => {
  assert.equal(
    resolveMetricsEndpoint('https://otlp-gateway.grafana.net/otlp/'),
    'https://otlp-gateway.grafana.net/otlp/v1/metrics'
  );
  assert.equal(
    resolveMetricsEndpoint('http://localhost:4318/v1/metrics'),
    'http://localhost:4318/v1/metrics'
  );
  assert.equal(
    resolveMetricsEndpoint('http://localhost:4318', 'https://custom.example/v1/metrics'),
    'https://custom.example/v1/metrics'
  );
  assert.equal(resolveMetricsEndpoint(undefined), undefined);
});

test('builds Grafana Basic auth while allowing standard OTLP header overrides', () => {
  assert.deepEqual(parseOtlpHeaders('X-Scope-OrgID=tenant,Authorization=Bearer%20token'), {
    'X-Scope-OrgID': 'tenant',
    Authorization: 'Bearer token',
  });
  assert.deepEqual(parseOtlpHeaders('X-Bad-Value=invalid%ZZ'), {
    'X-Bad-Value': 'invalid%ZZ',
  });

  assert.deepEqual(
    createOtlpHeaders({
      ...testConfig,
      cloudInstanceId: '12345',
      cloudApiKey: 'secret',
    }),
    { Authorization: `Basic ${Buffer.from('12345:secret').toString('base64')}` }
  );

  assert.deepEqual(
    createOtlpHeaders({
      ...testConfig,
      cloudInstanceId: '12345',
      cloudApiKey: 'secret',
      headers: 'Authorization=Bearer%20override',
    }),
    { Authorization: 'Bearer override' }
  );
});

test('records real OpenTelemetry data points for agent execution, failure, and retry', async () => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: testConfig.exportIntervalMs,
    exportTimeoutMillis: testConfig.exportTimeoutMs,
  });
  const provider = new MeterProvider({ readers: [reader] });
  const service = new GrafanaService({ config: testConfig, meterProvider: provider });

  service.recordAgentAttempt({
    workflowId: 'workflow_1',
    agentType: 'transcript',
    durationMs: 125,
    attempt: 2,
    status: 'failed',
    geminiLatency: 100,
    retryScheduled: true,
    errorCode: 'AGENT_TIMEOUT',
  });
  service.recordWorkflowStarted('workflow_1');
  service.recordWorkflowFinished('workflow_1', 'completed');

  assert.equal(await service.forceFlush(), true);

  const metrics = exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics);
  const metricNames = metrics.map((metric) => metric.descriptor.name);
  assert.deepEqual(metricNames.sort(), [
    'studioflow.agent.duration',
    'studioflow.agent.executions',
    'studioflow.agent.failures',
    'studioflow.agent.retries',
    'studioflow.gemini.latency',
    'studioflow.workflow.active',
    'studioflow.workflow.executions',
    'studioflow.workflow.step.duration',
  ]);

  const durationMetric = metrics.find(
    (metric) => metric.descriptor.name === 'studioflow.agent.duration'
  );
  assert.deepEqual(durationMetric.dataPoints[0].attributes, {
    workflowId: 'workflow_1',
    agentType: 'transcript',
    attempt: 2,
    status: 'failed',
    errorCode: 'AGENT_TIMEOUT',
  });
  assert.equal(durationMetric.dataPoints[0].value.sum, 125);

  const latestMetrics = exporter
    .getMetrics()
    .at(-1)
    .scopeMetrics.flatMap((scopeMetrics) => scopeMetrics.metrics);
  const workflowExecutions = latestMetrics.find(
    (metric) => metric.descriptor.name === 'studioflow.workflow.executions'
  );
  assert.equal(workflowExecutions.dataPoints[0].value, 1);
  assert.deepEqual(workflowExecutions.dataPoints[0].attributes, {
    workflowId: 'workflow_1',
    status: 'completed',
  });

  await provider.shutdown();
});

test('stays disabled without an endpoint and safely ignores metric calls', async () => {
  const service = new GrafanaService({ config: testConfig });

  assert.equal(service.isEnabled(), false);
  assert.doesNotThrow(() =>
    service.recordAgentAttempt({
      workflowId: 'workflow_1',
      agentType: 'transcript',
      durationMs: 10,
      attempt: 1,
      status: 'completed',
      geminiLatency: 8,
    })
  );
  assert.equal(await service.forceFlush(), false);
});

test('swallows exporter flush and shutdown failures', async () => {
  const instrument = { add() {}, record() {} };
  const meter = {
    createCounter() {
      return instrument;
    },
    createHistogram() {
      return instrument;
    },
    createUpDownCounter() {
      return instrument;
    },
  };
  const service = new GrafanaService({
    config: testConfig,
    meterProvider: {
      getMeter() {
        return meter;
      },
      async forceFlush() {
        throw new Error('Collector unavailable');
      },
      async shutdown() {
        throw new Error('Collector unavailable');
      },
    },
    ownsMeterProvider: true,
  });

  assert.equal(await service.forceFlush(), false);
  await assert.doesNotReject(service.shutdown());
});
