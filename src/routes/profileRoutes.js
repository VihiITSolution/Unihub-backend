const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getStudentProfile,
  upsertStudentProfile,
  getTutorProfile,
  applyAsTutor,
  updateTutorProfile,
  getPendingTutorApplications,
  reviewTutorApplication
} = require('../controllers/profileController');
const { getPreferences, updatePreferences } = require('../controllers/preferencesController');

const TUTOR_BIO_MAX_LENGTH = 1000;

const tutorApplicationValidators = [
  body('qualifications')
    .trim()
    .notEmpty()
    .withMessage('Qualifications & Education is required'),
  body('bio')
    .trim()
    .notEmpty()
    .withMessage('Bio is required')
    .bail()
    .isLength({ max: TUTOR_BIO_MAX_LENGTH })
    .withMessage(`Bio must be ${TUTOR_BIO_MAX_LENGTH} characters or fewer`),
  validate,
];

// Student profile routes
router.get('/student', authMiddleware, authorize('student'), getStudentProfile);
router.post('/student', authMiddleware, authorize('student'), upsertStudentProfile);
router.put('/student', authMiddleware, authorize('student'), upsertStudentProfile);

// Tutor profile routes
router.get('/tutor', authMiddleware, getTutorProfile);
router.post('/tutor/apply', authMiddleware, tutorApplicationValidators, applyAsTutor);
router.put('/tutor', authMiddleware, authorize('tutor'), tutorApplicationValidators, updateTutorProfile);

// Admin routes for tutor approval
router.get('/tutor/applications', authMiddleware, authorize('admin'), getPendingTutorApplications);
router.post('/tutor/applications/:tutorProfileId/review', authMiddleware, authorize('admin'), reviewTutorApplication);

// User preferences (notification + privacy)
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, updatePreferences);

module.exports = router;
