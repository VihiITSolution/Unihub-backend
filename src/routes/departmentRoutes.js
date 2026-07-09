const express = require("express");
const { body } = require("express-validator");
const { updateDepartment, deleteDepartment } = require("../controllers/facultyController");
const { authMiddleware, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

// PUT /departments/:id   (admin only)
router.put(
  "/:id",
  authMiddleware,
  authorize("admin"),
  [
    body("name").optional().trim().notEmpty(),
    body("isActive").optional().isBoolean(),
    body("order").optional().isInt({ min: 0 }),
    validate,
  ],
  updateDepartment,
);

// DELETE /departments/:id  (admin only — soft delete)
router.delete("/:id", authMiddleware, authorize("admin"), deleteDepartment);

module.exports = router;
