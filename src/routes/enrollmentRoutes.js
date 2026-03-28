const express = require("express");
const { body } = require("express-validator");
const {
  enrollInCourse,
  getMyEnrollments,
  updateProgress,
  cancelEnrollment,
  checkEnrollment,
  getTutorStudents,
} = require("../controllers/enrollmentController");
const { authMiddleware, authorize } = require("../middleware/auth");
const { createLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");

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
  "/",
  authMiddleware,
  authorize("student", "learner", "admin"),
  createLimiter,
  [
    body("courseId").isInt().withMessage("Valid course ID is required"),
    validate,
  ],
  enrollInCourse,
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
router.get(
  "/",
  authMiddleware,
  authorize("student", "admin"),
  getMyEnrollments,
);

/**
 * @swagger
 * /api/enrollments/check/{courseId}:
 *   get:
 *     tags: [Enrollments]
 *     summary: Check if user is enrolled in a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Enrollment status
 */
router.get("/check/:courseId", authMiddleware, checkEnrollment);

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
  "/:id/progress",
  authMiddleware,
  authorize("student", "admin"),
  updateProgress,
);

/**
 * @swagger
 * /api/enrollments/{id}:
 *   patch:
 *     tags: [Enrollments]
 *     summary: Update enrollment (progress and completed contents)
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
 *               completedContents:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [enrolled, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Enrollment updated successfully
 */
router.patch(
  "/:id",
  authMiddleware,
  authorize("student", "admin"),
  updateProgress,
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
  "/:id/cancel",
  authMiddleware,
  authorize("student", "admin"),
  cancelEnrollment,
);

/**
 * @swagger
 * /api/enrollments/tutor/students:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get all students enrolled in tutor's courses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrolled students with course details
 */
router.get(
  "/tutor/students",
  authMiddleware,
  authorize("tutor", "admin"),
  getTutorStudents,
);

module.exports = router;
