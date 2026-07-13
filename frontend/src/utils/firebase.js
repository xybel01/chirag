import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';

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

/**
 * Helper: Run multiple writes/deletes as a single transaction/batch commit.
 * Uses localStorage simulation in fallback mode.
 */
export async function runFirestoreBatch(operations) {
  if (!isFirebaseConfigured) {
    operations.forEach((op) => {
      const { type, collectionName, docId, data } = op;
      const list = JSON.parse(localStorage.getItem(`mock_fs_${collectionName}`) || '[]');
      const index = list.findIndex((item) => String(item.id) === String(docId));

      if (type === 'SET') {
        const docData = { id: docId, ...data, updatedAt: new Date().toISOString() };
        if (index > -1) {
          list[index] = { ...list[index], ...docData };
        } else {
          docData.createdAt = new Date().toISOString();
          list.push(docData);
        }
      } else if (type === 'DELETE') {
        if (index > -1) {
          list.splice(index, 1);
        }
      }
      localStorage.setItem(`mock_fs_${collectionName}`, JSON.stringify(list));
    });
    return;
  }

  try {
    const batch = writeBatch(db);
    operations.forEach((op) => {
      const { type, collectionName, docId, data } = op;
      const docRef = doc(db, collectionName, docId);
      if (type === 'SET') {
        batch.set(docRef, data, { merge: true });
      } else if (type === 'DELETE') {
        batch.delete(docRef);
      }
    });
    await batch.commit();
  } catch (error) {
    console.error('Firestore batch write failed:', error);
    throw error;
  }
}

// Seed mock data for local testing if not configured
if (!isFirebaseConfigured) {
  const seedMockCollection = (name, items) => {
    if (!localStorage.getItem(`mock_fs_${name}`)) {
      localStorage.setItem(`mock_fs_${name}`, JSON.stringify(items));
    }
  };

  // Seed employees / users
  seedMockCollection('users', [
    { id: 'usr-001', employeeId: 'EMP-001', employeeName: 'Chirag Gohil', email: 'chirag@nationwide-paper.com', department: 'IT', designation: 'IT Executive', companyName: 'Nationwide Paper', location: 'Head Office', reportingManager: 'John Doe', mobileNumber: '+91 98765 43210', employmentStatus: 'ACTIVE', profilePhoto: null },
    { id: 'usr-002', employeeId: 'EMP-002', employeeName: 'Darpit Ghadiya', email: 'accounts1@inventurewholesale.co.uk', department: 'Account', designation: 'Senior Accountant', companyName: 'Inventure Wholesale', location: 'Warehouse 1', reportingManager: 'Sarah Jenkins', mobileNumber: '+91 98765 43211', employmentStatus: 'ACTIVE', profilePhoto: null },
    { id: 'usr-003', employeeId: 'EMP-003', employeeName: 'Aaryan Patil', email: 'aaryan.patil@nationwide-paper.com', department: 'HR', designation: 'HR Generalist', companyName: 'Nationwide Paper', location: 'Branch Office', reportingManager: 'Jane Smith', mobileNumber: '+91 98765 43212', employmentStatus: 'ACTIVE', profilePhoto: null }
  ]);

  // Seed standard assets for assignment dropdowns
  seedMockCollection('assets', [
    { id: 'NPL-LT-0001', assetId: 'NPL-LT-0001', category: 'Laptop', subcategory: 'LT', deviceType: 'LAPTOP', manufacturer: 'Lenovo', model: 'ThinkPad T14', serialNumber: 'SN-T14-001', hostName: 'NPL-LT-0001', ram: '16 GB', storage: '512GB SSD', cpu: 'Intel Core i5', operatingSystem: 'Windows 11', condition: 'Good', status: 'AVAILABLE', location: 'Head Office' },
    { id: 'NPL-LT-0002', assetId: 'NPL-LT-0002', category: 'Laptop', subcategory: 'LT', deviceType: 'LAPTOP', manufacturer: 'Dell', model: 'Latitude 5430', serialNumber: 'SN-LAT-002', hostName: 'NPL-LT-0002', ram: '8 GB', storage: '256GB SSD', cpu: 'Intel Core i5', operatingSystem: 'Windows 11', condition: 'Good', status: 'AVAILABLE', location: 'Head Office' },
    { id: 'NPL-DT-0001', assetId: 'NPL-DT-0001', category: 'Desktop', subcategory: 'DT', deviceType: 'DESKTOP', manufacturer: 'HP', model: 'ProDesk 400', serialNumber: 'SN-PRO-001', hostName: 'NPL-DT-0001', ram: '16 GB', storage: '512GB SSD', cpu: 'Intel Core i7', operatingSystem: 'Windows 11', condition: 'Good', status: 'AVAILABLE', location: 'Head Office' },
    { id: 'NPL-MON-0012', assetId: 'NPL-MON-0012', category: 'Monitor', subcategory: 'MON', manufacturer: 'Dell', model: 'P2422H', serialNumber: 'SN-MON-012', screenSize: '24"', connectionType: 'HDMI', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-MON-0013', assetId: 'NPL-MON-0013', category: 'Monitor', subcategory: 'MON', manufacturer: 'Dell', model: 'P2422H', serialNumber: 'SN-MON-013', screenSize: '24"', connectionType: 'HDMI', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-KB-0031', assetId: 'NPL-KB-0031', category: 'Keyboard', subcategory: 'KB', manufacturer: 'Dell', model: 'KB216', serialNumber: 'SN-KB-031', brand: 'Dell', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-MOU-0042', assetId: 'NPL-MOU-0042', category: 'Mouse', subcategory: 'MOU', manufacturer: 'Dell', model: 'MS116', serialNumber: 'SN-MOU-042', brand: 'Dell', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-HP-0016', assetId: 'NPL-HP-0016', category: 'Headphone', subcategory: 'HP', manufacturer: 'Jabra', model: 'Evolve 20', serialNumber: 'SN-HP-016', brand: 'Jabra', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-WIFI-0005', assetId: 'NPL-WIFI-0005', category: 'Wi-Fi Adapter', subcategory: 'WIFI', manufacturer: 'TP-Link', model: 'Archer T3U', serialNumber: 'SN-WIFI-005', brand: 'TP-Link', macAddress: '00:11:22:33:44:55', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-BT-0008', assetId: 'NPL-BT-0008', category: 'Bluetooth Adapter', subcategory: 'BT', manufacturer: 'TP-Link', model: 'UB500', serialNumber: 'SN-BT-008', brand: 'TP-Link', macAddress: '00:11:22:33:44:66', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-MOB-0003', assetId: 'NPL-MOB-0003', category: 'Mobile Phone', subcategory: 'MOB', manufacturer: 'Samsung', model: 'Galaxy A14', serialNumber: 'SN-MOB-003', brand: 'Samsung', imeiNumber: '358912345678901', mobileNumber: '+91 99999 88888', simNumber: '8991123456789012345f', networkProvider: 'Jio', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-LC-0010', assetId: 'NPL-LC-0010', category: 'Laptop Charger', subcategory: 'LC', manufacturer: 'Lenovo', model: '65W Type-C', serialNumber: 'SN-LC-010', brand: 'Lenovo', wattage: '65W', chargerType: 'Type-C', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-MC-0006', assetId: 'NPL-MC-0006', category: 'Mobile Charger', subcategory: 'MC', manufacturer: 'Samsung', model: '25W PD Adapter', serialNumber: 'SN-MC-006', brand: 'Samsung', wattage: '25W', chargerType: 'Type-C', condition: 'Good', status: 'AVAILABLE' },
    { id: 'NPL-PRN-0004', assetId: 'NPL-PRN-0004', category: 'Printer', subcategory: 'PRN', manufacturer: 'HP', model: 'LaserJet Pro M404dn', serialNumber: 'SN-PRN-004', brand: 'HP', ipAddress: '192.168.1.150', macAddress: '00:11:22:33:44:77', connectionType: 'Network', condition: 'Good', status: 'AVAILABLE' }
  ]);
}

export { auth, db, isFirebaseConfigured };
