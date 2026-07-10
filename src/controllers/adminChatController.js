const { Op } = require("sequelize");
const { Conversation, Message, BlockedMessageLog, User } = require("../models");

const PARTICIPANT_ATTRIBUTES = [
  "id",
  "firstName",
  "lastName",
  "email",
  "profileImage",
  "primaryRole",
];

/** GET /api/admin/chat/conversations - every conversation platform-wide */
const getAllConversations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.contextType) {
      where.contextType = req.query.contextType;
    }
    if (req.query.isFlagged !== undefined) {
      where.isFlagged = req.query.isFlagged === "true";
    }

    let participantWhere;
    if (req.query.email || req.query.userId) {
      participantWhere = {};
      if (req.query.email) {
        participantWhere.email = { [Op.like]: `%${req.query.email}%` };
      }
      if (req.query.userId) {
        participantWhere.id = parseInt(req.query.userId, 10);
      }
    }

    const { count, rows } = await Conversation.findAndCountAll({
      where,
      include: [
        {
          association: "participantOne",
          attributes: PARTICIPANT_ATTRIBUTES,
          ...(participantWhere ? { where: participantWhere, required: false } : {}),
        },
        {
          association: "participantTwo",
          attributes: PARTICIPANT_ATTRIBUTES,
          ...(participantWhere ? { where: participantWhere, required: false } : {}),
        },
      ],
      order: [["lastMessageAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({
      success: true,
      data: {
        conversations: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/chat/conversations/:id/messages - full history, any conversation */
const getConversationMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id, {
      include: [
        { association: "participantOne", attributes: PARTICIPANT_ATTRIBUTES },
        { association: "participantTwo", attributes: PARTICIPANT_ATTRIBUTES },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    const messages = await Message.findAll({
      where: { conversationId: conversation.id },
      include: [
        { association: "sender", attributes: PARTICIPANT_ATTRIBUTES },
        { association: "attachments" },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json({ success: true, data: { conversation, messages } });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/admin/chat/conversations/:id/flag */
const flagConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    const { isFlagged, flagReason } = req.body;
    await conversation.update({
      isFlagged: isFlagged !== false,
      flagReason: flagReason || null,
      flaggedBy: req.user.id,
      flaggedAt: new Date(),
    });

    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/chat/blocked-messages */
const getBlockedMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.senderId) {
      where.senderId = parseInt(req.query.senderId, 10);
    }

    const { count, rows } = await BlockedMessageLog.findAndCountAll({
      where,
      include: [{ association: "sender", attributes: PARTICIPANT_ATTRIBUTES }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: {
        blockedMessages: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllConversations,
  getConversationMessages,
  flagConversation,
  getBlockedMessages,
};
