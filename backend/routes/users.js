import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  addSkill,
  removeSkill,
  updateAvailability,
  deleteOwnAccount,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from '../controllers/userController.js';
import { profileImageUpload } from '../middleware/upload.js';

const router = express.Router();

router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/profile/image', authenticateToken, profileImageUpload, uploadProfileImage);
router.post('/skills', authenticateToken, addSkill);
router.delete('/skills', authenticateToken, removeSkill);
router.put('/availability', authenticateToken, updateAvailability);
router.delete('/profile', authenticateToken, deleteOwnAccount);

router.get('/', authenticateToken, authorizeRole('admin'), getAllUsers);
router.get('/:id', authenticateToken, authorizeRole('admin'), getUserById);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateUserById);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteUserById);

export default router;
