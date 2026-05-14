import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attendanceDir = path.join(__dirname, '..', 'uploads', 'attendance');
const profileDir = path.join(__dirname, '..', 'uploads', 'profiles');
const eventsDir = path.join(__dirname, '..', 'uploads', 'events');
const teamsDir = path.join(__dirname, '..', 'uploads', 'teams');

if (!fs.existsSync(attendanceDir)) {
  fs.mkdirSync(attendanceDir, { recursive: true });
}
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}
if (!fs.existsSync(teamsDir)) {
  fs.mkdirSync(teamsDir, { recursive: true });
}

const attendanceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attendanceDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '');
    const safeBase = base ? base.slice(0, 40) : 'proof';
    cb(null, `${safeBase}-${Date.now()}${ext || '.jpg'}`);
  },
});

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

export const attendanceProofUpload = multer({
  storage: attendanceStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('proof');

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '');
    const safeBase = base ? base.slice(0, 40) : 'profile';
    cb(null, `${safeBase}-${Date.now()}${ext || '.jpg'}`);
  },
});

export const profileImageUpload = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('profileImage');

const eventAssetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, eventsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '');
    const safeBase = base ? base.slice(0, 40) : 'event-asset';
    cb(null, `${safeBase}-${Date.now()}${ext || '.jpg'}`);
  },
});

export const eventLogoUpload = multer({
  storage: eventAssetStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('eventLogo');

export const eventMottoImageUpload = multer({
  storage: eventAssetStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('mottoImage');

const teamAssetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, teamsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '');
    const safeBase = base ? base.slice(0, 40) : 'team-logo';
    cb(null, `${safeBase}-${Date.now()}${ext || '.jpg'}`);
  },
});

export const teamLogoUpload = multer({
  storage: teamAssetStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('teamLogo');
