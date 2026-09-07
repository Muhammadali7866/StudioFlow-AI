/**
 * Google Secret Manager service (M6-01)
 *
 * Fetches secrets from GCP Secret Manager in production.
 * Falls back transparently to process.env in development/test.
 *
 * Usage:
 *   const apiKey = await secretManagerService.getSecret('GEMINI_API_KEY');
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { env } from '@studioflow/config';

class SecretManagerService {
  private client?: SecretManagerServiceClient;
  private cache: Map<string, string> = new Map();
  private isProduction: boolean;

  constructor() {
    this.isProduction =
      env.nodeEnv === 'production' && !!env.googleApplicationCredentials;

    if (this.isProduction) {
      try {
        this.client = new SecretManagerServiceClient({
          projectId: env.googleCloudProjectId,
          keyFilename: env.googleApplicationCredentials,
        });
        console.log(
          '✅ [SecretManager] Connected to Google Cloud Secret Manager.'
        );
      } catch (err: any) {
        console.warn(
          '⚠️ [SecretManager] Could not initialize Secret Manager, falling back to env vars:',
          err?.message
        );
        this.client = undefined;
      }
    } else {
      console.log(
        'ℹ️ [SecretManager] Non-production mode. Secrets will be read from environment variables.'
      );
    }
  }

  /**
   * Retrieve a secret value by name.
   *
   * In production with Secret Manager available:
   *   - Fetches the latest version of the secret from GCP Secret Manager
   *   - Caches the result in-memory for subsequent calls
   *
   * In development or on error:
   *   - Falls back to process.env[secretName]
   *
   * @param secretName - The secret name (e.g. 'GEMINI_API_KEY')
   * @returns The secret value string, or undefined if not found
   */
  public async getSecret(secretName: string): Promise<string | undefined> {
    // 1. Return from cache if already fetched
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName);
    }

    // 2. Try Secret Manager in production
    if (this.client) {
      try {
        const name = `projects/${env.googleCloudProjectId}/secrets/${secretName}/versions/latest`;
        const [version] = await this.client.accessSecretVersion({ name });
        const payload = version.payload?.data?.toString();
        if (payload) {
          this.cache.set(secretName, payload);
          console.log(`🔐 [SecretManager] Fetched secret: ${secretName}`);
          return payload;
        }
      } catch (err: any) {
        console.warn(
          `⚠️ [SecretManager] Failed to fetch '${secretName}' from Secret Manager, falling back to env:`,
          err?.message
        );
      }
    }

    // 3. Fallback: read from environment variable
    const envValue = process.env[secretName];
    if (envValue) {
      this.cache.set(secretName, envValue);
    }
    return envValue;
  }

  /**
   * Warm up frequently used secrets at startup to avoid cold fetches on first request.
   */
  public async warmUp(secretNames: string[]): Promise<void> {
    await Promise.allSettled(secretNames.map((name) => this.getSecret(name)));
    console.log(
      `🔥 [SecretManager] Warmed up ${secretNames.length} secret(s).`
    );
  }
}

export const secretManagerService = new SecretManagerService();
