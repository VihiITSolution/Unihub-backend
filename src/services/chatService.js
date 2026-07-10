const { Op } = require("sequelize");
const {
  Conversation,
  Message,
  MessageAttachment,
  BlockedMessageLog,
  User,
} = require("../models");
const { canUsersConverse } = require("../utils/conversationPolicy");
const { checkMessageContent } = require("../utils/contentFilter");

class ChatError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.statusCode = status;
    this.code = code;
  }
}

const getOtherParticipantId = (conversation, userId) =>
  conversation.participantOneId === userId
    ? conversation.participantTwoId
    : conversation.participantOneId;

const isParticipant = (conversation, userId) =>
  conversation.participantOneId === userId ||
  conversation.participantTwoId === userId;

/**
 * Finds or creates the (canonically-ordered) 1:1 conversation between two
 * users, after checking the role-pair policy. Idempotent - calling this
 * again for the same pair returns the existing thread.
 */
async function findOrCreateConversation({
  requesterId,
  recipientId,
  contextType = "general",
  contextId = null,
}) {
  if (requesterId === recipientId) {
    throw new ChatError(400, "You cannot start a conversation with yourself.", "INVALID_RECIPIENT");
  }

  const [requester, recipient] = await Promise.all([
    User.findByPk(requesterId),
    User.findByPk(recipientId),
  ]);

  if (!recipient || !recipient.isActive) {
    throw new ChatError(404, "Recipient not found.", "RECIPIENT_NOT_FOUND");
  }

  if (!canUsersConverse(requester.roles, recipient.roles)) {
    throw new ChatError(
      403,
      "You are not permitted to message this user.",
      "PAIRING_NOT_ALLOWED",
    );
  }

  const participantOneId = Math.min(requesterId, recipientId);
  const participantTwoId = Math.max(requesterId, recipientId);

  const [conversation] = await Conversation.findOrCreate({
    where: { participantOneId, participantTwoId },
    defaults: { participantOneId, participantTwoId, contextType, contextId },
  });

  return conversation;
}

/**
 * Resolves (or creates) a support conversation between requesterId and an
 * admin. Which specific admin is nominally the participant is a low-stakes
 * detail since any admin can already read any conversation.
 */
async function findOrCreateSupportConversation(requesterId) {
  let adminId = process.env.SUPPORT_ADMIN_USER_ID
    ? parseInt(process.env.SUPPORT_ADMIN_USER_ID, 10)
    : null;

  if (!adminId) {
    const admin = await User.findOne({
      where: { primaryRole: "admin", isActive: true },
      order: [["id", "ASC"]],
    });
    if (!admin) {
      throw new ChatError(503, "Support is currently unavailable.", "NO_SUPPORT_ADMIN");
    }
    adminId = admin.id;
  }

  return findOrCreateConversation({
    requesterId,
    recipientId: adminId,
    contextType: "support",
  });
}

async function assertParticipant(conversationId, userId) {
  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    throw new ChatError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
  }
  if (!isParticipant(conversation, userId)) {
    throw new ChatError(403, "You are not a participant in this conversation.", "NOT_A_PARTICIPANT");
  }
  return conversation;
}

/**
 * Single shared entry point for creating a message, used by both the REST
 * send-message endpoint and the Socket.io `message:send` handler, so
 * neither transport can bypass the other's contact-info filtering.
 *
 * Returns either { blocked: true, reasons } or { blocked: false, message, conversation }.
 * Callers are responsible for broadcasting/notifying - this function is
 * transport-agnostic.
 */
async function sendMessage({ conversationId, senderId, body, attachments = [] }) {
  const conversation = await assertParticipant(conversationId, senderId);

  const trimmedBody = typeof body === "string" ? body.trim() : "";
  const hasBody = trimmedBody.length > 0;
  const hasAttachments = attachments.length > 0;

  if (!hasBody && !hasAttachments) {
    throw new ChatError(400, "Message cannot be empty.", "EMPTY_MESSAGE");
  }

  if (hasBody) {
    const { blocked, reasons } = checkMessageContent(trimmedBody);
    if (blocked) {
      await BlockedMessageLog.create({
        conversationId,
        senderId,
        attemptedBody: trimmedBody,
        matchedPatterns: reasons,
      });
      return { blocked: true, reasons };
    }
  }

  const message = await Message.create({
    conversationId,
    senderId,
    body: hasBody ? trimmedBody : null,
    messageType: hasAttachments ? "attachment" : "text",
  });

  if (hasAttachments) {
    await MessageAttachment.bulkCreate(
      attachments.map((a) => ({ ...a, messageId: message.id })),
    );
  }

  const preview = hasBody
    ? trimmedBody.slice(0, 255)
    : `Sent ${attachments.length > 1 ? "attachments" : "an attachment"}`;

  await conversation.update({
    lastMessageAt: new Date(),
    lastMessagePreview: preview,
  });

  const fullMessage = await Message.findByPk(message.id, {
    include: [
      { association: "sender", attributes: ["id", "firstName", "lastName", "profileImage", "primaryRole"] },
      { association: "attachments" },
    ],
  });

  return { blocked: false, message: fullMessage, conversation };
}

/** Marks every message sent by the *other* participant as read. */
async function markConversationRead(conversationId, userId) {
  const conversation = await assertParticipant(conversationId, userId);

  await Message.update(
    { isRead: true, readAt: new Date() },
    {
      where: {
        conversationId,
        senderId: { [Op.ne]: userId },
        isRead: false,
      },
    },
  );

  return conversation;
}

module.exports = {
  ChatError,
  getOtherParticipantId,
  isParticipant,
  findOrCreateConversation,
  findOrCreateSupportConversation,
  assertParticipant,
  sendMessage,
  markConversationRead,
};
