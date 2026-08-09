const express = require("express");
const { body } = require("express-validator");
const {
  getAllFaculties,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/facultyController");
const { authMiddleware, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { auditAdminAction } = require("../middleware/adminAudit");

const router = express.Router();

// ── Faculty routes ────────────────────────────────────────────────────────────

// GET /faculties              (public)
// GET /faculties?include=departments&active=true
router.get("/", getAllFaculties);

// GET /faculties/:id          (public)
router.get("/:id", getFacultyById);

// POST /faculties             (tutor or admin)
router.post(
  "/",
  authMiddleware,
  authorize("tutor", "admin"),
  auditAdminAction("faculty.created", "faculty", "Created a faculty"),
  [
    body("name").trim().notEmpty().withMessage("Faculty name is required"),
    body("icon").optional().trim(),
    body("description").optional().trim(),
    body("order").optional().isInt({ min: 0 }),
    validate,
  ],
  createFaculty,
);

// PUT /faculties/:id          (admin only)
router.put(
  "/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("faculty.updated", "faculty", "Updated a faculty"),
  [
    body("name").optional().trim().notEmpty(),
    body("icon").optional().trim(),
    body("description").optional().trim(),
    body("isActive").optional().isBoolean(),
    body("order").optional().isInt({ min: 0 }),
    validate,
  ],
  updateFaculty,
);

// DELETE /faculties/:id       (admin only)
router.delete("/:id", authMiddleware, authorize("admin"), auditAdminAction("faculty.deleted", "faculty", "Deleted a faculty"), deleteFaculty);

// ── Department sub-routes ─────────────────────────────────────────────────────

// GET /faculties/:id/departments          (public)
router.get("/:id/departments", getDepartments);

// POST /faculties/:id/departments         (admin only)
router.post(
  "/:id/departments",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("department.created", "department", "Created a department"),
  [
    body("name").trim().notEmpty().withMessage("Department name is required"),
    body("order").optional().isInt({ min: 0 }),
    validate,
  ],
  createDepartment,
);

module.exports = router;
