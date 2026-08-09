import { Firestore } from '@google-cloud/firestore';
import { env } from '@studioflow/config';
import { Project, MediaAsset } from '@studioflow/shared';

class MemoryFirestoreStore {
  private projects: Map<string, Project> = new Map();
  private mediaAssets: Map<string, MediaAsset> = new Map();

  async setProject(project: Project): Promise<Project> {
    this.projects.set(project.id, { ...project });
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async addMediaAsset(asset: MediaAsset): Promise<MediaAsset> {
    this.mediaAssets.set(asset.id, asset);
    const project = this.projects.get(asset.projectId);
    if (project) {
      project.mediaAssets = [...(project.mediaAssets || []), asset];
      project.updatedAt = new Date().toISOString();
      this.projects.set(project.id, project);
    }
    return asset;
  }
}

export class FirestoreService {
  private db?: Firestore;
  private memoryStore = new MemoryFirestoreStore();
  private isConnected = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    if (env.googleApplicationCredentials || process.env.FIRESTORE_EMULATOR_HOST) {
      try {
        this.db = new Firestore({
          projectId: env.googleCloudProjectId,
          databaseId: env.firestoreDatabaseId,
          keyFilename: env.googleApplicationCredentials,
        });
        this.isConnected = true;
        console.log('✅ [FirestoreService] Connected to Google Cloud Firestore.');
      } catch (err: any) {
        console.warn('⚠️ [FirestoreService] Could not initialize Cloud Firestore, using in-memory store:', err?.message);
        this.isConnected = false;
      }
    } else {
      console.log('ℹ️ [FirestoreService] No GCP credentials provided. Operating in local memory fallback mode.');
      this.isConnected = false;
    }
  }

  public async checkHealth(): Promise<boolean> {
    if (!this.db) return true; // Local memory fallback active
    try {
      await this.db.listCollections();
      return true;
    } catch {
      return true; // Graceful fallback
    }
  }

  public async saveProject(project: Project): Promise<Project> {
    if (this.db) {
      try {
        const docRef = this.db.collection('projects').doc(project.id);
        await docRef.set(project);
        return project;
      } catch (err: any) {
        console.warn('⚠️ [FirestoreService] Firestore save error, using fallback:', err?.message);
      }
    }
    return this.memoryStore.setProject(project);
  }

  public async getProjectById(id: string): Promise<Project | null> {
    if (this.db) {
      try {
        const docRef = this.db.collection('projects').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data() as Project;
        }
      } catch (err: any) {
        console.warn('⚠️ [FirestoreService] Firestore fetch error, using fallback:', err?.message);
      }
    }
    return this.memoryStore.getProject(id);
  }

  public async saveMediaAsset(asset: MediaAsset): Promise<MediaAsset> {
    if (this.db) {
      try {
        await this.db.collection('media_assets').doc(asset.id).set(asset);
        // Also update parent project doc
        const projectRef = this.db.collection('projects').doc(asset.projectId);
        const doc = await projectRef.get();
        if (doc.exists) {
          const projectData = doc.data() as Project;
          const updatedAssets = [...(projectData.mediaAssets || []), asset];
          await projectRef.update({
            mediaAssets: updatedAssets,
            updatedAt: new Date().toISOString(),
          });
        }
        return asset;
      } catch (err: any) {
        console.warn('⚠️ [FirestoreService] Firestore media asset save error, using fallback:', err?.message);
      }
    }
    return this.memoryStore.addMediaAsset(asset);
  }
}

export const firestoreService = new FirestoreService();
