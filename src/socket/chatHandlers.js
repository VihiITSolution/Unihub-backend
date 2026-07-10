const chatService = require("../services/chatService");
const { createNotification } = require("../controllers/notificationController");
const presence = require("./presence");

const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;
const presenceRoom = (userId) => `presence:${userId}`;

/**
 * Registers all chat-related Socket.io event handlers for one connection.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
const registerChatHandlers = (io, socket) => {
  const userId = socket.user.id;

  socket.join(userRoom(userId));
  presence.addSocket(userId, socket.id);
  io.to(presenceRoom(userId)).emit("presence:update", {
    userId,
    isOnline: true,
    lastSeenAt: new Date(),
  });

  socket.on("conversation:join", async ({ conversationId } = {}) => {
    try {
      await chatService.assertParticipant(conversationId, userId);
      socket.join(conversationRoom(conversationId));
    } catch (error) {
      socket.emit("error", { message: error.message, code: error.code });
    }
  });

  socket.on("conversation:leave", ({ conversationId } = {}) => {
    if (conversationId) {
      socket.leave(conversationRoom(conversationId));
    }
  });

  socket.on("typing:start", ({ conversationId } = {}) => {
    if (conversationId && socket.rooms.has(conversationRoom(conversationId))) {
      socket.to(conversationRoom(conversationId)).emit("typing:update", {
        conversationId,
        userId,
        isTyping: true,
      });
    }
  });

  socket.on("typing:stop", ({ conversationId } = {}) => {
    if (conversationId && socket.rooms.has(conversationRoom(conversationId))) {
      socket.to(conversationRoom(conversationId)).emit("typing:update", {
        conversationId,
        userId,
        isTyping: false,
      });
    }
  });

  socket.on("presence:subscribe", ({ userIds } = {}) => {
    if (!Array.isArray(userIds)) return;
    userIds.forEach((id) => {
      socket.join(presenceRoom(id));
      socket.emit("presence:update", { userId: id, isOnline: presence.isOnline(id) });
    });
  });

  socket.on("message:send", async ({ conversationId, body, tempId } = {}) => {
    try {
      const result = await chatService.sendMessage({
        conversationId,
        senderId: userId,
        body,
      });

      if (result.blocked) {
        socket.emit("message:rejected", {
          conversationId,
          tempId,
          code: "CONTACT_INFO_DETECTED",
          reasons: result.reasons,
          message:
            "Your message appears to contain contact information. Please remove it and try again.",
        });
        return;
      }

      const { message, conversation } = result;

      io.to(conversationRoom(conversationId)).emit("message:new", {
        conversationId,
        message,
      });

      io.to(userRoom(conversation.participantOneId))
        .to(userRoom(conversation.participantTwoId))
        .emit("conversation:updated", {
          conversationId,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
        });

      const recipientId = chatService.getOtherParticipantId(conversation, userId);
      if (!presence.isOnline(recipientId)) {
        await createNotification(
          recipientId,
          "general",
          "New message",
          conversation.lastMessagePreview || "You have a new message",
          `/chat/${conversationId}`,
        );
      }
    } catch (error) {
      socket.emit("message:rejected", {
        conversationId,
        tempId,
        code: error.code || "SEND_FAILED",
        reasons: [],
        message: error.message || "Failed to send message.",
      });
    }
  });

  socket.on("message:read", async ({ conversationId } = {}) => {
    try {
      await chatService.markConversationRead(conversationId, userId);
      io.to(conversationRoom(conversationId)).emit("message:read", {
        conversationId,
        readerId: userId,
        readAt: new Date(),
      });
    } catch (error) {
      socket.emit("error", { message: error.message, code: error.code });
    }
  });

  socket.on("disconnect", () => {
    const wentOffline = presence.removeSocket(userId, socket.id);
    if (wentOffline) {
      io.to(presenceRoom(userId)).emit("presence:update", {
        userId,
        isOnline: false,
        lastSeenAt: new Date(),
      });
    }
  });
};

module.exports = registerChatHandlers;
