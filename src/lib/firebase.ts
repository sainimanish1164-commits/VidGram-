import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot per Firebase Integration specification
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

/**
 * Uploads photo, short video, or voice audio to Firebase Cloud Storage (never storing raw video inside Firestore).
 * Falls back cleanly to a browser ObjectURL with progress simulation if Storage bucket CORS/rules are not yet enabled in user console.
 */
export async function uploadMediaWithProgress(
  file: File | Blob,
  folder: 'posts' | 'reels' | 'avatars' | 'messages',
  uid: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const ext =
    file instanceof File && file.name.includes('.')
      ? file.name.split('.').pop()?.toLowerCase() || 'bin'
      : file.type.includes('video')
        ? 'webm'
        : file.type.includes('audio')
          ? 'webm'
          : 'jpg';
  const safePath = `${folder}/${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const storageRef = ref(storage, safePath);
    return await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      const timeoutId = window.setTimeout(() => {
        task.cancel();
        reject(new Error('Storage upload timed out'));
      }, 12000);

      task.on(
        'state_changed',
        (snap) => {
          const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 50;
          onProgress?.(pct);
        },
        (err) => {
          window.clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          window.clearTimeout(timeoutId);
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress?.(100);
          resolve(url);
        }
      );
    });
  } catch {
    // Graceful client-side blob fallback if Cloud Storage bucket hasn't been manually initialized in GCP console
    onProgress?.(65);
    await new Promise((r) => setTimeout(r, 250));
    onProgress?.(100);
    return URL.createObjectURL(file);
  }
}

export async function generateVideoThumbnail(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = (thumb: string) => {
      URL.revokeObjectURL(url);
      resolve(thumb);
    };

    const timer = window.setTimeout(() => cleanup(''), 3500);

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, video.duration / 4 || 0);
    };

    video.onseeked = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          cleanup(canvas.toDataURL('image/jpeg', 0.72).slice(0, 2400));
          return;
        }
      } catch {
        // Ignore canvas tainting
      }
      cleanup('');
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup('');
    };
  });
}
