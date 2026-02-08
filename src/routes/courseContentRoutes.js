const express = require("express");
const { body } = require("express-validator");
const {
  addCourseContent,
  getCourseContent,
  updateCourseContent,
  deleteCourseContent,
} = require("../controllers/courseContentController");
const { authMiddleware, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadVideo } = require("../config/upload");

const router = express.Router();

// Add content to a course
router.post(
  "/courses/:courseId/content",
  authMiddleware,
  authorize("tutor", "admin"),
  uploadVideo,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("type")
      .isIn(["video", "pdf"])
      .withMessage("Type must be video or pdf"),
    validate,
  ],
  addCourseContent,
);

// Get all content for a course
router.get("/courses/:courseId/content", getCourseContent);

// Update course content
router.put(
  "/content/:contentId",
  authMiddleware,
  authorize("tutor", "admin"),
  updateCourseContent,
);

// Delete course content
router.delete(
  "/content/:contentId",
  authMiddleware,
  authorize("tutor", "admin"),
  deleteCourseContent,
);

module.exports = router;
