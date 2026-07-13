const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../middleware/upload');
const firebaseService = require('../services/firebase.service');
const admin = require('firebase-admin');

// Authenticated file serving - uploads are never exposed as public static files.
router.get('/:name', authenticate, async (req, res, next) => {
  try {
    const name = path.basename(req.params.name); // prevent path traversal

    if (firebaseService.isFirebaseEnabled) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(`uploads/${name}`);
        const [exists] = await file.exists();
        if (exists) {
          // Get signed URL valid for 15 minutes
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
          });
          return res.redirect(url);
        }
      } catch (fbErr) {
        console.error('Firebase storage check failed, falling back to local file:', fbErr.message);
      }
    }

    const filePath = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
