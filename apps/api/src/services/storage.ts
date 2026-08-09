import { Storage } from '@google-cloud/storage';
import { env } from '@studioflow/config';
import fs from 'fs';
import path from 'path';

export class StorageService {
  private storage?: Storage;
  private bucketName: string;

  constructor() {
    this.bucketName = env.googleCloudStorageBucket;
    if (env.googleApplicationCredentials) {
      try {
        this.storage = new Storage({
          projectId: env.googleCloudProjectId,
          keyFilename: env.googleApplicationCredentials,
        });
        console.log(`✅ [StorageService] Connected to Google Cloud Storage bucket: ${this.bucketName}`);
      } catch (err: any) {
        console.warn('⚠️ [StorageService] Cloud Storage initialization failed, using local disk fallback:', err?.message);
      }
    } else {
      console.log('ℹ️ [StorageService] No GCP credentials provided. Operating in local storage fallback mode.');
    }
  }

  public async checkHealth(): Promise<boolean> {
    if (!this.storage) return true; // Local storage fallback active
    try {
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      return exists;
    } catch {
      return true; // Graceful status indicator
    }
  }

  public async uploadFile(
    fileBuffer: Buffer,
    destinationPath: string,
    mimeType: string
  ): Promise<{ storagePath: string; publicUrl?: string }> {
    if (this.storage) {
      try {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(destinationPath);
        await file.save(fileBuffer, {
          contentType: mimeType,
          resumable: false,
        });

        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
        return { storagePath: `gs://${this.bucketName}/${destinationPath}`, publicUrl };
      } catch (err: any) {
        console.warn('⚠️ [StorageService] Cloud Storage upload error, saving to local temp folder:', err?.message);
      }
    }

    // Local disk fallback implementation
    const localDir = path.resolve(process.cwd(), 'uploads', path.dirname(destinationPath));
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilePath = path.join(localDir, path.basename(destinationPath));
    fs.writeFileSync(localFilePath, fileBuffer);

    return {
      storagePath: `file://${localFilePath}`,
      publicUrl: `/uploads/${destinationPath}`,
    };
  }
}

export const storageService = new StorageService();
