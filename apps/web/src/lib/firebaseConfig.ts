// Lightweight Firebase initialization that tolerates missing env config in development.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";

const hasMinimalConfig = Boolean(apiKey && projectId);

let firebaseApp: FirebaseApp | null = null;

try {
  if (hasMinimalConfig) {
    if (!getApps().length) {
      firebaseApp = initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      });
    } else {
      firebaseApp = getApp();
    }
  } else {
    // No config available; keep null to allow the app to work without Firebase in dev
    console.warn("Firebase not configured. Preferences persistence will be disabled until env vars are provided.");
  }
} catch (e) {
  console.warn("Failed to initialize Firebase app:", e);
  firebaseApp = null;
}

export const app = firebaseApp;
export const FIREBASE_ENABLED = Boolean(firebaseApp);