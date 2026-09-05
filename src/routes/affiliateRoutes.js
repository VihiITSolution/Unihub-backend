const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { getAffiliateMe, updatePayoutProfile, requestRedemption } = require("../controllers/affiliateController");

const router = express.Router();
router.get("/me", authMiddleware, getAffiliateMe);
router.put("/payout-profile", authMiddleware, updatePayoutProfile);
router.post("/redemptions", authMiddleware, requestRedemption);
module.exports = router;
