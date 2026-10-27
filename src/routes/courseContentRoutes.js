const express = require("express");
const { body } = require("express-validator");
const {
  addCourseContent,
  getCourseContent,
  updateCourseContent,
  deleteCourseContent,
  getContentById,
} = require("../controllers/courseContentController");
const {
  getMyYouTubeRightsDeclaration,
  signYouTubeRightsDeclaration,
} = require("../controllers/youtubeRightsDeclarationController");
const { receiveChunk, completeChunkedUpload } = require("../controllers/chunkUploadController");
const {
  authMiddleware,
  authorize,
  optionalAuthMiddleware,
} = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadVideo } = require("../config/upload");
const { uploadPDF } = require("../config/cloudinary");

const router = express.Router();

// One-time signed declaration used for all externally linked YouTube lessons.
router.get(
  "/youtube-rights-declaration",
  authMiddleware,
  authorize("tutor"),
  getMyYouTubeRightsDeclaration,
);
router.post(
  "/youtube-rights-declaration",
  authMiddleware,
  authorize("tutor"),
  signYouTubeRightsDeclaration,
);

// ── Chunked video upload (bypasses nginx body-size limit) ─────────────────────
// Must be defined before the generic /:courseId/content route.
router.post(
  "/courses/:courseId/content/chunks",
  authMiddleware,
  authorize("tutor", "admin"),
  receiveChunk,
);
router.post(
  "/courses/:courseId/content/chunks/complete",
  authMiddleware,
  authorize("tutor", "admin"),
  completeChunkedUpload,
);

// Add content to a course
router.post(
  "/courses/:courseId/content",
  authMiddleware,
  authorize("tutor", "admin"),
  (req, res, next) => {
    // For multipart/form-data, req.body may not be populated before multer runs.
    // Prefer query type and safely fall back to body when present.
    const type = String(req.query?.type || req.body?.type || "").toLowerCase();
    if (type === "pdf") {
      uploadPDF(req, res, next);
    } else if (type === "link") {
      next();
    } else {
      uploadVideo(req, res, next);
    }
  },
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("type")
      .isIn(["video", "pdf", "link"])
      .withMessage("Type must be video, pdf, or link"),
    validate,
  ],
  addCourseContent,
);

// Get all content for a course (guest-accessible; non-preview lesson urls
// are only included for enrolled/owning/admin users, see controller)
router.get(
  "/courses/:courseId/content",
  optionalAuthMiddleware,
  getCourseContent,
);

// Get specific content by ID (requires enrollment)
router.get("/content/:contentId", authMiddleware, getContentById);

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
