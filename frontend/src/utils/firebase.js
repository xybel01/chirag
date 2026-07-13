import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    }
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log('Firebase client SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase client SDK:', error);
  }
} else {
  console.warn(
    'WARNING: Firebase client environment variables are missing (VITE_FIREBASE_API_KEY, etc.).\n' +
    'Firebase Auth will run in Simulated/Fallback Mode.'
  );
}

/**
 * Handles Google Sign-In.
 * In fallback mode, simulates a Google login popup and returns a mock ID token.
 */
export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    // Simulated Google Login
    return new Promise((resolve) => {
      // Simulate network latency
      setTimeout(() => {
        // We will prompt or pick a simulated role for the developer
        const choice = window.confirm(
          "Firebase config is empty. Do you want to simulate logging in with Google as an ADMIN?\n\n" +
          "Click 'OK' for ADMIN, or 'Cancel' for standard EMPLOYEE."
        );
        
        const email = choice ? "google-admin@nationwide-paper.com" : "google-employee@nationwide-paper.com";
        const name = choice ? "Google Admin" : "Google Employee";
        const role = choice ? "ADMIN" : "EMPLOYEE";
        
        const mockToken = `mock-firebase-token-${email}-${name}-${role}`;
        resolve({
          token: mockToken,
          user: {
            email,
            displayName: name,
            photoURL: null,
          }
        });
      }, 500);
    });
  }

  // Real Firebase Google Login
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const token = await result.user.getIdToken();
    return {
      token,
      user: result.user,
    };
  } catch (error) {
    console.error('Error signing in with Google via Firebase:', error);
    throw error;
  }
}

export { auth, isFirebaseConfigured };
