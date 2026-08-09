const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { authMiddleware, authorize } = require("../middleware/auth");
const { auditAdminAction } = require("../middleware/adminAudit");

// Public routes
router.get("/", categoryController.getCategories);
router.get("/:slug", categoryController.getCategoryWithCourses);

// Taxonomy mutation is restricted to administrators.
router.post("/", authMiddleware, authorize("admin"), auditAdminAction("category.created", "category", "Created a course category"), categoryController.createCategory);
router.put("/:id", authMiddleware, authorize("admin"), auditAdminAction("category.updated", "category", "Updated a course category"), categoryController.updateCategory);
router.delete("/:id", authMiddleware, authorize("admin"), auditAdminAction("category.deleted", "category", "Deleted a course category"), categoryController.deleteCategory);

module.exports = router;
