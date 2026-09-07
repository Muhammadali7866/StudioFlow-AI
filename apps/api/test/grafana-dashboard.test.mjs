import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const dashboardUrl = new URL('../../../docs/grafana-dashboard.json', import.meta.url);

test('ships an importable dashboard for every StudioFlow health signal', async () => {
  const dashboard = JSON.parse(await readFile(dashboardUrl, 'utf8'));
  const panelTitles = dashboard.panels.map((panel) => panel.title);
  assert.deepEqual(panelTitles, [
    'Workflow Success Rate',
    'Active Workflows',
    'Retries',
    'Agent Duration',
    'Agent Error Rate',
    'Gemini Latency',
    'Workflow Step Duration',
  ]);

  const expressions = dashboard.panels
    .flatMap((panel) => panel.targets)
    .map((target) => target.expr)
    .join('\n');
  for (const metric of [
    'studioflow_workflow_executions_total',
    'studioflow_workflow_active',
    'studioflow_agent_retries_total',
    'studioflow_agent_duration_milliseconds_bucket',
    'studioflow_agent_failures_total',
    'studioflow_agent_executions_total',
    'studioflow_gemini_latency_milliseconds_bucket',
    'studioflow_workflow_step_duration_milliseconds_bucket',
  ]) {
    assert.match(expressions, new RegExp(metric));
  }

  assert.equal(dashboard.templating.list[0].type, 'datasource');
  assert.equal(dashboard.refresh, '5s');
  assert.equal(dashboard.uid, 'studioflow-agent-health');
});
