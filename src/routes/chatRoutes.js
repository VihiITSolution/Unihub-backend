const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { uploadChatAttachments } = require("../config/chatUpload");
const chatController = require("../controllers/chatController");

router.get("/unread-count", authMiddleware, chatController.getUnreadCount);
router.get("/conversations", authMiddleware, chatController.getConversations);
router.post("/conversations", authMiddleware, chatController.createConversation);
router.post("/support", authMiddleware, chatController.createSupportConversation);
router.get("/conversations/:id", authMiddleware, chatController.getConversationById);
router.get("/conversations/:id/messages", authMiddleware, chatController.getMessages);
router.post(
  "/conversations/:id/messages",
  authMiddleware,
  uploadChatAttachments,
  chatController.sendMessage,
);
router.put("/conversations/:id/read", authMiddleware, chatController.markRead);

module.exports = router;
