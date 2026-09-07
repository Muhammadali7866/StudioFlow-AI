/**
 * Firebase Auth token validation middleware (M6-01)
 *
 * Validates the Firebase ID token from the `Authorization: Bearer <token>` header.
 * On success: attaches decoded user info to req.user and calls next().
 * On failure: returns 401 Unauthorized immediately (no stack trace exposed).
 *
 * Auth can be disabled for local development by setting AUTH_ENABLED=false in .env.
 */
import { Request, Response, NextFunction } from 'express';
import { env } from '@studioflow/config';
import { getFirebaseAdmin } from '../services/firebase-admin';
import { AppError } from './error.middleware';

// Extend the Express Request type to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth if disabled (local dev / test mode)
  if (!env.authEnabled) {
    // Inject a synthetic dev user so downstream code works consistently
    req.user = { uid: 'dev_user', email: 'dev@studioflow.local' };
    next();
    return;
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(
      new AppError(
        'Missing or malformed Authorization header. Expected: Bearer <token>',
        401,
        'UNAUTHORIZED'
      )
    );
    return;
  }

  const idToken = authHeader.slice(7); // Strip "Bearer " prefix

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (err: any) {
    // Log the full error server-side for debugging
    console.warn(
      `🔒 [AuthMiddleware] Token verification failed: ${err?.message}`
    );
    // Return a sanitized 401 (no internal details exposed to client)
    next(
      new AppError(
        'Invalid or expired authentication token.',
        401,
        'UNAUTHORIZED'
      )
    );
  }
}
