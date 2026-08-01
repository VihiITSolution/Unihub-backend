const express = require("express");
const { body, validationResult } = require("express-validator");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");

const router = express.Router();

// POST /api/newsletter/subscribe
router.post(
  "/subscribe",
  [body("email").isEmail().normalizeEmail().withMessage("Valid email required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email } = req.body;

    try {
      const [, created] = await NewsletterSubscriber.findOrCreate({ where: { email } });
      if (!created) {
        return res.json({ success: true, alreadySubscribed: true, message: "You're already subscribed!" });
      }
      return res.json({ success: true, alreadySubscribed: false, message: "Subscribed! We'll be in touch." });
    } catch (err) {
      console.error("Newsletter subscribe error:", err);
      res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
  }
);

module.exports = router;
