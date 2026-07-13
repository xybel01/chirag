const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const HttpError = require('../utils/httpError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED[ext] || ALLOWED[ext] !== file.mimetype) {
    return cb(new HttpError(400, 'Only PDF, PNG and JPG files are allowed'));
  }
  cb(null, true);
};

const { uploadToFirebaseStorage } = require('../services/firebase.service');

const uploadFirebaseDocs = async (req, _res, next) => {
  if (req.files) {
    for (const key in req.files) {
      const fileList = req.files[key];
      for (const file of fileList) {
        try {
          await uploadToFirebaseStorage(file.path, file.filename, file.mimetype);
        } catch (error) {
          console.error(`Firebase upload failed for ${file.filename}:`, error.message);
        }
      }
    }
  }
  next();
};

module.exports = {
  UPLOAD_DIR,
  upload: multer({ storage, fileFilter, limits: { fileSize: config.maxUploadMb * 1024 * 1024 } }),
  uploadFirebaseDocs,
};
