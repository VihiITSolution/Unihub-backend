const express = require("express");
const { body } = require("express-validator");
const {
  getAllFaculties,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} = require("../controllers/facultyController");
const { authMiddleware, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

// Get all faculties (public)
router.get("/", getAllFaculties);

// Get faculty by ID (public)
router.get("/:id", getFacultyById);

// Create faculty (Tutor or Admin)
router.post(
  "/",
  authMiddleware,
  authorize("tutor", "admin"),
  [
    body("name").trim().notEmpty().withMessage("Faculty name is required"),
    body("icon").optional().trim(),
    body("description").optional().trim(),
    validate,
  ],
  createFaculty,
);

// Update faculty (Admin only)
router.put(
  "/:id",
  authMiddleware,
  authorize("admin"),
  [
    body("name").optional().trim().notEmpty(),
    body("icon").optional().trim(),
    body("description").optional().trim(),
    body("isActive").optional().isBoolean(),
    validate,
  ],
  updateFaculty,
);

// Delete/Deactivate faculty (Admin only)
router.delete("/:id", authMiddleware, authorize("admin"), deleteFaculty);

module.exports = router;
