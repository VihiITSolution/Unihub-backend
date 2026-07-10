const { Op } = require("sequelize");
const { Conversation, Message } = require("../models");
const chatService = require("../services/chatService");
const { classifyFile } = require("../config/chatUpload");
const presence = require("../socket/presence");
const { createNotification } = require("./notificationController");

const PARTICIPANT_ATTRIBUTES = [
  "id",
  "firstName",
  "lastName",
  "profileImage",
  "primaryRole",
];

const serializeConversation = (conversation, userId, unreadCount = 0) => {
  const other =
    conversation.participantOneId === userId
      ? conversation.participantTwo
      : conversation.participantOne;

  return {
    id: conversation.id,
    contextType: conversation.contextType,
    contextId: conversation.contextId,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    isFlagged: conversation.isFlagged,
    otherParticipant: other
      ? {
          id: other.id,
          firstName: other.firstName,
          lastName: other.lastName,
          profileImage: other.profileImage,
          primaryRole: other.primaryRole,
        }
      : null,
    unreadCount,
  };
};

const handleError = (error, res, next) => {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
  next(error);
};

/** GET /api/chat/conversations */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Conversation.findAndCountAll({
      where: {
        [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      include: [
        { association: "participantOne", attributes: PARTICIPANT_ATTRIBUTES },
        { association: "participantTwo", attributes: PARTICIPANT_ATTRIBUTES },
      ],
      order: [["lastMessageAt", "DESC"]],
      limit,
      offset,
    });

    const conversations = await Promise.all(
      rows.map(async (conversation) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: conversation.id,
            senderId: { [Op.ne]: userId },
            isRead: false,
          },
        });
        return serializeConversation(conversation, userId, unreadCount);
      }),
    );

    res.status(200).json({
      success: true,
      data: {
        conversations,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

const fetchSerializedConversation = async (conversationId, userId) => {
  const conversation = await Conversation.findByPk(conversationId, {
    include: [
      { association: "participantOne", attributes: PARTICIPANT_ATTRIBUTES },
      { association: "participantTwo", attributes: PARTICIPANT_ATTRIBUTES },
    ],
  });
  return serializeConversation(conversation, userId);
};

/** POST /api/chat/conversations */
const createConversation = async (req, res, next) => {
  try {
    const { recipientId, contextType, contextId } = req.body;
    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: "recipientId is required.",
      });
    }

    const conversation = await chatService.findOrCreateConversation({
      requesterId: req.user.id,
      recipientId: parseInt(recipientId, 10),
      contextType,
      contextId: contextId ? parseInt(contextId, 10) : null,
    });

    const data = await fetchSerializedConversation(conversation.id, req.user.id);
    res.status(200).json({ success: true, data: { conversation: data } });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** POST /api/chat/support */
const createSupportConversation = async (req, res, next) => {
  try {
    const conversation = await chatService.findOrCreateSupportConversation(req.user.id);
    const data = await fetchSerializedConversation(conversation.id, req.user.id);
    res.status(200).json({ success: true, data: { conversation: data } });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** GET /api/chat/conversations/:id */
const getConversationById = async (req, res, next) => {
  try {
    await chatService.assertParticipant(req.params.id, req.user.id);
    const data = await fetchSerializedConversation(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { conversation: data } });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** GET /api/chat/conversations/:id/messages */
const getMessages = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    await chatService.assertParticipant(conversationId, req.user.id);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = (page - 1) * limit;

    const { count, rows } = await Message.findAndCountAll({
      where: { conversationId, isDeleted: false },
      include: [
        {
          association: "sender",
          attributes: ["id", "firstName", "lastName", "profileImage", "primaryRole"],
        },
        { association: "attachments" },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: {
        messages: rows.reverse(),
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** POST /api/chat/conversations/:id/messages (multipart) */
const sendMessage = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const attachments = (req.files || []).map((file) => ({
      url: file.path,
      publicId: file.filename,
      fileType: file.chatFileType || classifyFile(file) || "document",
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size || null,
    }));

    const result = await chatService.sendMessage({
      conversationId,
      senderId: req.user.id,
      body: req.body.body,
      attachments,
    });

    if (result.blocked) {
      return res.status(422).json({
        success: false,
        message:
          "Your message appears to contain contact information. Please remove it and try again.",
        code: "CONTACT_INFO_DETECTED",
        reasons: result.reasons,
      });
    }

    const { message, conversation } = result;
    const io = req.app.get("io");

    if (io) {
      io.to(`conversation:${conversationId}`).emit("message:new", {
        conversationId: Number(conversationId),
        message,
      });
      io.to(`user:${conversation.participantOneId}`)
        .to(`user:${conversation.participantTwoId}`)
        .emit("conversation:updated", {
          conversationId: Number(conversationId),
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
        });
    }

    const recipientId = chatService.getOtherParticipantId(conversation, req.user.id);
    if (!presence.isOnline(recipientId)) {
      await createNotification(
        recipientId,
        "general",
        "New message",
        conversation.lastMessagePreview || "You have a new message",
        `/chat/${conversationId}`,
      );
    }

    res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** PUT /api/chat/conversations/:id/read */
const markRead = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    await chatService.markConversationRead(conversationId, req.user.id);

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation:${conversationId}`).emit("message:read", {
        conversationId: Number(conversationId),
        readerId: req.user.id,
        readAt: new Date(),
      });
    }

    res.status(200).json({ success: true, message: "Messages marked as read." });
  } catch (error) {
    handleError(error, res, next);
  }
};

/** GET /api/chat/unread-count */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await Message.count({
      where: { senderId: { [Op.ne]: userId }, isRead: false },
      include: [
        {
          association: "conversation",
          attributes: [],
          where: {
            [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }],
          },
          required: true,
        },
      ],
    });

    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    handleError(error, res, next);
  }
};

module.exports = {
  getConversations,
  createConversation,
  createSupportConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markRead,
  getUnreadCount,
};
