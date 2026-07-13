import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

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
let db = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    }
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    console.log('Firebase client SDK and Firestore initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase client SDK:', error);
  }
} else {
  console.warn(
    'WARNING: Firebase client environment variables are missing (VITE_FIREBASE_API_KEY, etc.).\n' +
    'Firebase features will run in Simulated/Fallback Mode.'
  );
}

/**
 * Handles Google Sign-In.
 * In fallback mode, simulates a Google login popup and returns a mock ID token.
 */
export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    return new Promise((resolve) => {
      setTimeout(() => {
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

/**
 * Helper: Query all items from collection.
 * Uses localStorage simulation in fallback mode.
 */
export async function getCollectionItems(collectionName) {
  if (!isFirebaseConfigured) {
    const list = JSON.parse(localStorage.getItem(`mock_fs_${collectionName}`) || '[]');
    return list;
  }
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Helper: Save document to collection (creates or updates).
 * Uses localStorage simulation in fallback mode.
 */
export async function setCollectionDoc(collectionName, docId, data) {
  if (!isFirebaseConfigured) {
    const list = JSON.parse(localStorage.getItem(`mock_fs_${collectionName}`) || '[]');
    const index = list.findIndex(item => String(item.id) === String(docId));
    const docData = { id: docId, ...data, updatedAt: new Date().toISOString() };
    if (index > -1) {
      list[index] = { ...list[index], ...docData };
    } else {
      docData.createdAt = new Date().toISOString();
      list.push(docData);
    }
    localStorage.setItem(`mock_fs_${collectionName}`, JSON.stringify(list));
    return docData;
  }
  try {
    const docRef = doc(db, collectionName, docId);
    const docData = { ...data, updatedAt: new Date().toISOString() };
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      docData.createdAt = new Date().toISOString();
    }
    await setDoc(docRef, docData, { merge: true });
    return docData;
  } catch (error) {
    console.error(`Error writing document ${docId} in ${collectionName}:`, error);
    throw error;
  }
}

export { auth, db, isFirebaseConfigured };
