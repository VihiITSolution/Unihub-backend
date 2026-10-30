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

// Literal paths must be registered before the '/:id' routes below. Express
// matches in declaration order, so '/my/enrollments' would otherwise be
// captured by '/:id/enrollments' with id === 'my' and return 404.
router.get('/my/enrollments', authMiddleware, sessionEnrollmentController.getMyEnrollments);
router.get('/mine', authMiddleware, authorize('tutor', 'admin'), liveSessionController.getMyLiveSessions);
router.get('/meeting-identity', authMiddleware, liveSessionController.getMeetingIdentity);
router.post('/meeting-identity', authMiddleware, liveSessionController.setMeetingIdentity);
router.get('/:id/referral-link', authMiddleware, authorize('tutor', 'admin'), liveSessionController.getLiveSessionReferralLink);
router.get('/:id/referral-invite', liveSessionController.getLiveSessionReferralInvite);
router.post('/:id/referral-enroll', authMiddleware, sessionEnrollmentController.enrollFromReferralInvite);

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

// Recording metadata and course publishing are deliberately separate from the
// session scheduler: recordings remain editable after a session has ended.
router.put(
  '/:id/recording',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.updateRecording
);

router.post(
  '/:id/recording/course-content',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.addRecordingToCourse
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
  '/:id/rejoin',
  authMiddleware,
  authorize('tutor', 'admin'),
  liveSessionController.rejoinLiveSession
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


module.exports = router;
