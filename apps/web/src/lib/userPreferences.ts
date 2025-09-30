import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "./firebaseConfig";

// Use a variável global __app_id conforme as instruções (via globalThis para evitar erro de TS)
const appId: string = (globalThis as any).__app_id ?? 'default-app-id';

type UserPreferences = {
  selectedPoolId?: string | null;
  selectedChampionshipId?: string | null;
  lastUpdated?: Date | any;
};

function getDb() {
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (e) {
    console.error("Firestore not available:", e);
    return null;
  }
}

export async function saveUserPreferences(userId: string | null | undefined, poolId: string | null, championshipId: string | null) {
  if (!userId) {
    console.error('User ID is not available. Cannot save preferences.');
    return;
  }
  const db = getDb();
  if (!db) return;

  const userPreferencesRef = doc(db, `/artifacts/${appId}/users/${userId}/preferences/main`);
  try {
    await setDoc(userPreferencesRef, {
      selectedPoolId: poolId,
      selectedChampionshipId: championshipId,
      lastUpdated: new Date()
    }, { merge: true });
    console.log('User preferences saved successfully.');
  } catch (e) {
    console.error('Error saving user preferences: ', e);
  }
}

export async function loadUserPreferences(userId: string | null | undefined): Promise<UserPreferences | null> {
  if (!userId) {
    console.error('User ID is not available. Cannot load preferences.');
    return null;
  }
  const db = getDb();
  if (!db) return null;

  const userPreferencesRef = doc(db, `/artifacts/${appId}/users/${userId}/preferences/main`);
  try {
    const docSnap = await getDoc(userPreferencesRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPreferences;
    } else {
      console.log('No user preferences found.');
      return null;
    }
  } catch (e) {
    console.error('Error loading user preferences: ', e);
    return null;
  }
}