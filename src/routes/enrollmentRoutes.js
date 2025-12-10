const express = require('express');
const { body } = require('express-validator');
const { 
  enrollInCourse, 
  getMyEnrollments, 
  updateProgress, 
  cancelEnrollment 
} = require('../controllers/enrollmentController');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Enroll in a course
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *             properties:
 *               courseId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Enrolled successfully
 */
router.post(
  '/',
  authMiddleware,
  authorize('learner', 'admin'),
  createLimiter,
  [
    body('courseId').isInt().withMessage('Valid course ID is required'),
    validate
  ],
  enrollInCourse
);

/**
 * @swagger
 * /api/enrollments:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get my enrollments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrollments
 */
router.get('/', authMiddleware, authorize('learner', 'admin'), getMyEnrollments);

/**
 * @swagger
 * /api/enrollments/{id}/progress:
 *   put:
 *     tags: [Enrollments]
 *     summary: Update enrollment progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               progress:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               status:
 *                 type: string
 *                 enum: [enrolled, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Progress updated successfully
 */
router.put(
  '/:id/progress',
  authMiddleware,
  authorize('learner', 'admin'),
  updateProgress
);

/**
 * @swagger
 * /api/enrollments/{id}/cancel:
 *   put:
 *     tags: [Enrollments]
 *     summary: Cancel enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Enrollment cancelled successfully
 */
router.put(
  '/:id/cancel',
  authMiddleware,
  authorize('learner', 'admin'),
  cancelEnrollment
);

module.exports = router;
