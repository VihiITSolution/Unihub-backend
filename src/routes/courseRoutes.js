const express = require("express");
const { body } = require("express-validator");
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getMyCourses,
  submitForReview,
} = require("../controllers/courseController");
const { authMiddleware, optionalAuthMiddleware, authorize } = require("../middleware/auth");
const { createLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { uploadThumbnail } = require("../config/cloudinary");

const router = express.Router();

/**
 * @swagger
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a new course (Tutor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *               price:
 *                 type: number
 *               duration:
 *                 type: integer
 *               thumbnail:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               contentUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Course created successfully
 */
router.post(
  "/",
  authMiddleware,
  authorize("tutor", "admin"),
  uploadThumbnail,
  createLimiter,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    validate,
  ],
  createCourse
);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get all courses with filters
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of courses
 */
router.get("/", getCourses);

/**
 * @swagger
 * /api/courses/my-courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get my courses (Tutor)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tutor's courses
 */
router.get(
  "/my-courses",
  authMiddleware,
  authorize("tutor", "admin"),
  getMyCourses
);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Course details
 */
router.get("/:id", optionalAuthMiddleware, getCourseById);

/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     tags: [Courses]
 *     summary: Update course
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
 *         description: Course updated successfully
 */
router.put(
  "/:id",
  authMiddleware,
  authorize("tutor", "admin"),
  uploadThumbnail,
  updateCourse
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete course
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
 *         description: Course deleted successfully
 */
router.delete(
  "/:id",
  authMiddleware,
  authorize("tutor", "admin"),
  deleteCourse
);

/**
 * @swagger
 * /api/courses/{id}/submit-for-review:
 *   post:
 *     tags: [Courses]
 *     summary: Submit course for review (Tutor only)
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
 *         description: Course submitted for review
 */
router.post(
  "/:id/submit-for-review",
  authMiddleware,
  authorize("tutor"),
  submitForReview
);

module.exports = router;
