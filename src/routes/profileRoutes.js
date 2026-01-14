const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const {
  getStudentProfile,
  upsertStudentProfile,
  getTutorProfile,
  applyAsTutor,
  updateTutorProfile,
  getPendingTutorApplications,
  reviewTutorApplication
} = require('../controllers/profileController');

// Student profile routes
router.get('/student', authMiddleware, authorize('student'), getStudentProfile);
router.post('/student', authMiddleware, authorize('student'), upsertStudentProfile);
router.put('/student', authMiddleware, authorize('student'), upsertStudentProfile);

// Tutor profile routes
router.get('/tutor', authMiddleware, getTutorProfile);
router.post('/tutor/apply', authMiddleware, applyAsTutor);
router.put('/tutor', authMiddleware, authorize('tutor'), updateTutorProfile);

// Admin routes for tutor approval
router.get('/tutor/applications', authMiddleware, authorize('admin'), getPendingTutorApplications);
router.post('/tutor/applications/:tutorProfileId/review', authMiddleware, authorize('admin'), reviewTutorApplication);

module.exports = router;
