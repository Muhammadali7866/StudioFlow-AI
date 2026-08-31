import { Firestore } from '@google-cloud/firestore';
import { env } from '@studioflow/config';
import { Project, MediaAsset, Workflow } from '@studioflow/shared';

function cloneWorkflow(workflow: Workflow): Workflow {
  return structuredClone(workflow);
}

class MemoryFirestoreStore {
  private projects: Map<string, Project> = new Map();
  private mediaAssets: Map<string, MediaAsset> = new Map();
  private workflows: Map<string, Workflow> = new Map();

  async setProject(project: Project): Promise<Project> {
    this.projects.set(project.id, { ...project });
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
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

  async setWorkflow(workflow: Workflow): Promise<Workflow> {
    const stored = cloneWorkflow(workflow);
    this.workflows.set(workflow.id, stored);
    return cloneWorkflow(stored);
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const workflow = this.workflows.get(id);
    return workflow ? cloneWorkflow(workflow) : null;
  }

  async updateWorkflow(
    id: string,
    update: (workflow: Workflow) => Workflow
  ): Promise<Workflow | null> {
    const current = this.workflows.get(id);
    if (!current) return null;
    const updated = update(cloneWorkflow(current));
    this.workflows.set(id, cloneWorkflow(updated));
    return cloneWorkflow(updated);
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
        console.warn(
          '⚠️ [FirestoreService] Could not initialize Cloud Firestore, using in-memory store:',
          err?.message
        );
        this.isConnected = false;
      }
    } else {
      console.log(
        'ℹ️ [FirestoreService] No GCP credentials provided. Operating in local memory fallback mode.'
      );
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

  public async listProjects(): Promise<Project[]> {
    if (this.db) {
      try {
        const snapshot = await this.db.collection('projects').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc) => doc.data() as Project);
      } catch (err: any) {
        console.warn('⚠️ [FirestoreService] Firestore list error, using fallback:', err?.message);
      }
    }
    return this.memoryStore.getAllProjects();
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
        console.warn(
          '⚠️ [FirestoreService] Firestore media asset save error, using fallback:',
          err?.message
        );
      }
    }
    return this.memoryStore.addMediaAsset(asset);
  }

  public async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    await this.memoryStore.setWorkflow(workflow);
    if (this.db) {
      try {
        await this.db.collection('workflows').doc(workflow.id).set(workflow);
      } catch (err: any) {
        console.warn(
          '⚠️ [FirestoreService] Firestore workflow save error, using fallback:',
          err?.message
        );
      }
    }
    return cloneWorkflow(workflow);
  }

  public async getWorkflowById(id: string): Promise<Workflow | null> {
    if (this.db) {
      try {
        const doc = await this.db.collection('workflows').doc(id).get();
        if (doc.exists) {
          const workflow = doc.data() as Workflow;
          await this.memoryStore.setWorkflow(workflow);
          return cloneWorkflow(workflow);
        }
      } catch (err: any) {
        console.warn(
          '⚠️ [FirestoreService] Firestore workflow fetch error, using fallback:',
          err?.message
        );
      }
    }
    return this.memoryStore.getWorkflow(id);
  }

  public async updateWorkflow(
    id: string,
    update: (workflow: Workflow) => Workflow
  ): Promise<Workflow | null> {
    if (this.db) {
      try {
        const docRef = this.db.collection('workflows').doc(id);
        const updated = await this.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) return null;
          const nextWorkflow = update(snapshot.data() as Workflow);
          transaction.set(docRef, nextWorkflow);
          return nextWorkflow;
        });
        if (updated) {
          await this.memoryStore.setWorkflow(updated);
          return cloneWorkflow(updated);
        }
        return null;
      } catch (err: any) {
        if (err instanceof Error && 'code' in err && 'statusCode' in err) {
          throw err;
        }
        console.warn(
          '⚠️ [FirestoreService] Firestore workflow update error, using fallback:',
          err?.message
        );
      }
    }
    return this.memoryStore.updateWorkflow(id, update);
  }
}

export const firestoreService = new FirestoreService();
