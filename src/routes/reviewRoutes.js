const express = require("express");
const { body } = require("express-validator");
const {
  addReview,
  getCourseReviews,
  getUserReview,
  deleteReview,
} = require("../controllers/reviewController");
const { authMiddleware } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Add or update a review for a course
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
 *               - rating
 *             properties:
 *               courseId:
 *                 type: integer
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review added/updated successfully
 */
router.post(
  "/",
  authMiddleware,
  [
    body("courseId").isInt().withMessage("Valid course ID is required"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment").optional().isString().trim(),
    validate,
  ],
  addReview,
);

/**
 * @swagger
 * /api/reviews/course/{courseId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get reviews for a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
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
 *         description: List of reviews
 */
router.get("/course/:courseId", getCourseReviews);

/**
 * @swagger
 * /api/reviews/my-review/{courseId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get user's review for a specific course
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
 *         description: User's review
 */
router.get("/my-review/:courseId", authMiddleware, getUserReview);

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete a review
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
 *         description: Review deleted successfully
 */
router.delete("/:id", authMiddleware, deleteReview);

module.exports = router;
