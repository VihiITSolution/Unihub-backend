const express = require('express');
const router = express.Router();
const liveSessionController = require('../controllers/liveSessionController');
const sessionEnrollmentController = require('../controllers/sessionEnrollmentController');
const { authMiddleware, authorize } = require('../middleware/auth');

// Live session management (tutors only)
router.post(
  '/',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.createLiveSession
);

router.get(
  '/',
  liveSessionController.getLiveSessions
);

router.get('/mine', authMiddleware, authorize('tutor', 'admin'), liveSessionController.getMyLiveSessions);
router.get('/meeting-identity', authMiddleware, liveSessionController.getMeetingIdentity);
router.post('/meeting-identity', authMiddleware, liveSessionController.setMeetingIdentity);

router.get(
  '/:id',
  liveSessionController.getLiveSession
);

router.put(
  '/:id',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.updateLiveSession
);

router.delete(
  '/:id',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.cancelLiveSession
);

// Session control
router.post(
  '/:id/start',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.startLiveSession
);

router.post(
  '/:id/end',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.endLiveSession
);

// Student enrollment
router.post(
  '/:id/enroll',
  authMiddleware,
  sessionEnrollmentController.enrollInSession
);

router.post(
  '/:id/invite',
  authMiddleware,
  authorize('tutor', 'admin'),
  sessionEnrollmentController.inviteStudents
);

router.get(
  '/:id/enrollments',
  authMiddleware,
  sessionEnrollmentController.getSessionEnrollments
);

// Student actions
router.post(
  '/:id/join',
  authMiddleware,
  sessionEnrollmentController.joinSession
);

router.post(
  '/:id/leave',
  authMiddleware,
  sessionEnrollmentController.leaveSession
);

// My enrollments
router.get(
  '/my/enrollments',
  authMiddleware,
  sessionEnrollmentController.getMyEnrollments
);

module.exports = router;
