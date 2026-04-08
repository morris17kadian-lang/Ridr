import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseReady = missingFirebaseConfig.length === 0;
export const authEnabled = false;

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = null;

export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export const firebaseServices = [
  { label: 'Runtime', value: 'Expo SDK 54 + TypeScript' },
  { label: 'Authentication', value: authEnabled ? 'Firebase Auth enabled' : 'Disabled for styling pass' },
  { label: 'Database', value: 'Cloud Firestore client ready' },
  { label: 'Files', value: 'Firebase Storage client ready' },
];