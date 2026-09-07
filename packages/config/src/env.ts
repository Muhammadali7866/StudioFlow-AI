import dotenv from 'dotenv';
import path from 'path';

// Attempt to load .env from workspace root if running locally
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  googleCloudProjectId: string;
  googleCloudRegion: string;
  googleApplicationCredentials?: string;
  firestoreDatabaseId: string;
  googleCloudStorageBucket: string;
  geminiApiKey?: string;
  geminiModel: string;
  nextPublicApiUrl: string;
  otelExporterOtlpEndpoint?: string;
  otelExporterOtlpMetricsEndpoint?: string;
  otelExporterOtlpHeaders?: string;
  grafanaCloudInstanceId?: string;
  grafanaCloudApiKey?: string;
  grafanaMetricsExportIntervalMs: number;
  grafanaMetricsExportTimeoutMs: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function validateAndGetConfig(): AppConfig {
  const config: AppConfig = {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'studioflow-ai-dev',
    googleCloudRegion: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    googleCloudStorageBucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'studioflow-ai-media-dev',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    otelExporterOtlpEndpoint:
      process.env.GRAFANA_CLOUD_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelExporterOtlpMetricsEndpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    otelExporterOtlpHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    grafanaCloudInstanceId: process.env.GRAFANA_CLOUD_INSTANCE_ID,
    grafanaCloudApiKey: process.env.GRAFANA_CLOUD_API_KEY,
    grafanaMetricsExportIntervalMs: positiveInteger(
      process.env.GRAFANA_METRICS_EXPORT_INTERVAL_MS,
      15_000
    ),
    grafanaMetricsExportTimeoutMs: positiveInteger(
      process.env.GRAFANA_METRICS_EXPORT_TIMEOUT_MS,
      5_000
    ),
  };

  const warnings: string[] = [];

  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    warnings.push('GOOGLE_CLOUD_PROJECT_ID not set. Defaulting to studioflow-ai-dev.');
  }

  if (!process.env.GEMINI_API_KEY) {
    warnings.push('GEMINI_API_KEY not set. Root Agent will operate in demo fallback mode.');
  }

  if (warnings.length > 0 && config.nodeEnv !== 'test') {
    console.warn('⚠️ [StudioFlow Config Warning]:\n' + warnings.map((w) => ` - ${w}`).join('\n'));
  }

  return config;
}

export const env = validateAndGetConfig();
