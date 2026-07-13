const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;
let isFirebaseEnabled = false;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (projectId && clientEmail && privateKey) {
  try {
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
      storageBucket: storageBucket || `${projectId}.appspot.com`,
    });
    isFirebaseEnabled = true;
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error.message);
  }
} else {
  console.warn(
    'WARNING: Firebase environment variables are missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).\n' +
    'Firebase features will run in Simulated/Fallback Mode.'
  );
}

/**
 * Verifies a Firebase ID token.
 * In fallback mode, accepts mock tokens of the format "mock-firebase-token-EMAIL-NAME-ROLE".
 */
async function verifyFirebaseIdToken(token) {
  if (!token) {
    throw new Error('No token provided');
  }

  if (!isFirebaseEnabled) {
    // Fallback/Simulated verification
    if (token.startsWith('mock-firebase-token-')) {
      const parts = token.split('-');
      const email = parts[3] || 'google-user@nationwide-paper.com';
      const name = parts[4] || 'Google User';
      const role = parts[5] || 'EMPLOYEE';
      return {
        email,
        name,
        uid: `mock-uid-${email}`,
        email_verified: true,
        role,
      };
    }
    throw new Error('Firebase integration is in fallback mode. Use mock tokens starting with "mock-firebase-token-" for local testing.');
  }

  // Real verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email.split('@')[0],
      uid: decodedToken.uid,
      email_verified: decodedToken.email_verified,
    };
  } catch (error) {
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }
}

/**
 * Uploads a local file to Firebase Cloud Storage.
 * In fallback mode, does nothing (keeps using local file path).
 */
async function uploadToFirebaseStorage(localFilePath, fileName, mimeType) {
  if (!isFirebaseEnabled || !storageBucket) {
    console.log(`[Firebase Storage - Fallback] File ${fileName} remains stored locally.`);
    return null;
  }

  try {
    const bucket = admin.storage().bucket();
    const destination = `uploads/${fileName}`;

    await bucket.upload(localFilePath, {
      destination,
      metadata: {
        contentType: mimeType,
      },
    });

    // Get signed URL for long expiration
    const file = bucket.file(destination);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2126', // long expiration
    });

    console.log(`[Firebase Storage] Uploaded ${fileName} successfully. URL: ${url}`);
    return url;
  } catch (error) {
    console.error(`[Firebase Storage] Failed to upload ${fileName}:`, error.message);
    return null;
  }
}

module.exports = {
  isFirebaseEnabled,
  verifyFirebaseIdToken,
  uploadToFirebaseStorage,
};
