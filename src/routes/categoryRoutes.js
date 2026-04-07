const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { authMiddleware } = require("../middleware/auth");

// Public routes
router.get("/", categoryController.getCategories);
router.get("/:slug", categoryController.getCategoryWithCourses);

// Protected routes (Tutor only)
router.post("/", authMiddleware, categoryController.createCategory);
router.put("/:id", authMiddleware, categoryController.updateCategory);
router.delete("/:id", authMiddleware, categoryController.deleteCategory);

module.exports = router;
