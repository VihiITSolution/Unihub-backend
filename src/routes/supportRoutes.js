const express = require("express");
const { body } = require("express-validator");
const { authMiddleware } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadTicketAttachments } = require("../config/cloudinary");
const { createTicket, getMyTickets } = require("../controllers/supportTicketController");

const router = express.Router();

const CATEGORIES = [
  "technical",
  "account",
  "course",
  "enrollment",
  "payment",
  "marketplace",
  "feature",
  "other",
];

router.post(
  "/tickets",
  authMiddleware,
  (req, res, next) => {
    uploadTicketAttachments(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  [
    body("subject").trim().notEmpty().withMessage("Subject is required").bail().isLength({ max: 255 }),
    body("category").isIn(CATEGORIES).withMessage("Please select a valid category"),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
    body("description")
      .trim()
      .isLength({ min: 20, max: 5000 })
      .withMessage("Description must be at least 20 characters"),
    validate,
  ],
  createTicket,
);

router.get("/tickets", authMiddleware, getMyTickets);

module.exports = router;
