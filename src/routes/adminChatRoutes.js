const express = require("express");
const router = express.Router();
const { authMiddleware, authorize } = require("../middleware/auth");
const { auditAdminAction } = require("../middleware/adminAudit");
const adminChatController = require("../controllers/adminChatController");

router.get(
  "/conversations",
  authMiddleware,
  authorize("admin"),
  adminChatController.getAllConversations,
);
router.get(
  "/conversations/:id/messages",
  authMiddleware,
  authorize("admin"),
  adminChatController.getConversationMessages,
);
router.put(
  "/conversations/:id/flag",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("chat.flag_updated", "conversation", "Updated a conversation moderation flag"),
  adminChatController.flagConversation,
);
router.get(
  "/blocked-messages",
  authMiddleware,
  authorize("admin"),
  adminChatController.getBlockedMessages,
);

module.exports = router;
