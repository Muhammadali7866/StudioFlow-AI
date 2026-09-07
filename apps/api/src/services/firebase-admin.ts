/**
 * Firebase Admin SDK singleton initializer (M6-01)
 *
 * Initializes firebase-admin once using:
 *  - GOOGLE_APPLICATION_CREDENTIALS (service account key file) in local/dev
 *  - Application Default Credentials (ADC) automatically on Cloud Run (no key file needed)
 */
import * as admin from 'firebase-admin';
import { env } from '@studioflow/config';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    if (admin.apps.length === 0) {
      const initOptions: admin.AppOptions = {
        projectId: env.firebaseProjectId,
      };

      // Use explicit service account key if provided (local dev / CI)
      if (env.googleApplicationCredentials) {
        initOptions.credential = admin.credential.cert(
          env.googleApplicationCredentials
        );
      } else {
        // Cloud Run / GKE: use Application Default Credentials automatically
        initOptions.credential = admin.credential.applicationDefault();
      }

      admin.initializeApp(initOptions);
      console.log(
        `✅ [FirebaseAdmin] Initialized for project: ${env.firebaseProjectId}`
      );
    }
    initialized = true;
  }
  return admin.app();
}

export { admin };
