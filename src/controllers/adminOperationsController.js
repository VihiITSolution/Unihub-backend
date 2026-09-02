const { Op } = require("sequelize");
const { SupportTicket, User, AdminAuditLog } = require("../models");
const sequelize = require("../config/sequelize");
const { createNotification } = require("./notificationController");

const ADMIN_ATTRIBUTES = ["id", "firstName", "lastName", "email"];
const TICKET_INCLUDES = [
  { model: User, as: "user", attributes: ADMIN_ATTRIBUTES },
  { model: User, as: "assignedAdmin", attributes: ADMIN_ATTRIBUTES, required: false },
  { model: User, as: "lastUpdatedByAdmin", attributes: ADMIN_ATTRIBUTES, required: false },
];

const paginationFrom = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

const getSupportTickets = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationFrom(req.query);
    const where = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.category) where.category = req.query.category;
    if (req.query.assignedTo === "me") where.assignedToAdminId = req.user.id;
    if (req.query.assignedTo === "unassigned") where.assignedToAdminId = null;
    if (req.query.search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${req.query.search}%` } },
        { description: { [Op.like]: `%${req.query.search}%` } },
      ];
    }

    const { count, rows } = await SupportTicket.findAndCountAll({
      where,
      include: TICKET_INCLUDES,
      order: [
        ["priority", "DESC"],
        ["createdAt", "ASC"],
      ],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({
      success: true,
      data: {
        tickets: rows,
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id, {
      include: TICKET_INCLUDES,
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found." });
    }
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

const updateSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found." });
    }

    const allowedStatuses = ["open", "in_progress", "resolved", "closed"];
    const allowedPriorities = ["low", "medium", "high", "critical"];
    const updates = { lastUpdatedByAdminId: req.user.id };

    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: "Invalid support-ticket status." });
      }
      updates.status = req.body.status;
      updates.resolvedAt = ["resolved", "closed"].includes(req.body.status) ? new Date() : null;
    }

    if (req.body.priority !== undefined) {
      if (!allowedPriorities.includes(req.body.priority)) {
        return res.status(400).json({ success: false, message: "Invalid support-ticket priority." });
      }
      updates.priority = req.body.priority;
    }

    if (req.body.assignToMe === true) {
      updates.assignedToAdminId = req.user.id;
    } else if (req.body.assignedToAdminId === null) {
      updates.assignedToAdminId = null;
    }

    if (req.body.adminResponse !== undefined) {
      const adminResponse = String(req.body.adminResponse).trim();
      if (adminResponse.length < 2 || adminResponse.length > 5000) {
        return res.status(400).json({
          success: false,
          message: "The response must contain between 2 and 5,000 characters.",
        });
      }
      updates.adminResponse = adminResponse;
      updates.respondedAt = new Date();
    }

    await ticket.update(updates);

    if (updates.adminResponse || updates.status) {
      try {
        await createNotification(
          ticket.userId,
          "general",
          `Support ticket #${ticket.id} updated`,
          updates.adminResponse || `Your ticket status is now ${ticket.status.replace("_", " ")}.`,
          "/help",
          { ticketId: ticket.id, status: ticket.status },
        );
      } catch (notificationError) {
        console.error("Failed to notify support-ticket owner:", notificationError.message);
      }
    }

    const refreshed = await SupportTicket.findByPk(ticket.id, { include: TICKET_INCLUDES });
    res.status(200).json({
      success: true,
      message: "Support ticket updated successfully.",
      data: { ticket: refreshed },
    });
  } catch (error) {
    next(error);
  }
};

const bulkUpdateSupportTickets = async (req, res, next) => {
  try {
    const ticketIds = Array.from(
      new Set(
        (Array.isArray(req.body.ticketIds) ? req.body.ticketIds : [])
          .map((id) => Number(id))
          .filter(Number.isInteger),
      ),
    );

    if (ticketIds.length === 0 || ticketIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Select between 1 and 50 support tickets.",
      });
    }

    const allowedStatuses = ["open", "in_progress", "resolved", "closed"];
    const allowedPriorities = ["low", "medium", "high", "critical"];
    const updates = { lastUpdatedByAdminId: req.user.id };

    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: "Invalid support-ticket status." });
      }
      updates.status = req.body.status;
      updates.resolvedAt = ["resolved", "closed"].includes(req.body.status) ? new Date() : null;
    }

    if (req.body.priority !== undefined) {
      if (!allowedPriorities.includes(req.body.priority)) {
        return res.status(400).json({ success: false, message: "Invalid support-ticket priority." });
      }
      updates.priority = req.body.priority;
    }

    if (req.body.assignToMe === true) {
      updates.assignedToAdminId = req.user.id;
    } else if (req.body.assignedToAdminId === null) {
      updates.assignedToAdminId = null;
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({
        success: false,
        message: "Choose a status, priority, or assignment change.",
      });
    }

    const existingTickets = await SupportTicket.findAll({
      where: { id: { [Op.in]: ticketIds } },
      attributes: ["id", "userId"],
    });
    if (existingTickets.length !== ticketIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more selected support tickets no longer exist.",
      });
    }

    await SupportTicket.update(updates, { where: { id: { [Op.in]: ticketIds } } });

    if (updates.status) {
      await Promise.all(
        existingTickets.map((ticket) =>
          createNotification(
            ticket.userId,
            "general",
            `Support ticket #${ticket.id} updated`,
            `Your ticket status is now ${updates.status.replace("_", " ")}.`,
            "/help",
            { ticketId: ticket.id, status: updates.status },
          ).catch((notificationError) => {
            console.error("Failed to notify support-ticket owner:", notificationError.message);
          }),
        ),
      );
    }

    res.status(200).json({
      success: true,
      message: `${ticketIds.length} support ticket${ticketIds.length === 1 ? "" : "s"} updated.`,
      data: { updatedCount: ticketIds.length },
    });
  } catch (error) {
    next(error);
  }
};

const getAdminAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationFrom(req.query, 50);
    const where = {};
    if (req.query.action) where.action = req.query.action;
    if (req.query.targetType) where.targetType = req.query.targetType;
    if (req.query.actorAdminId) where.actorAdminId = req.query.actorAdminId;
    if (req.query.search && String(req.query.search).trim()) {
      const term = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [
        { action: { [Op.like]: term } },
        { summary: { [Op.like]: term } },
        { targetId: { [Op.like]: term } },
      ];
    }

    const { count, rows } = await AdminAuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: "actorAdmin", attributes: ADMIN_ATTRIBUTES, required: false }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: {
        logs: rows,
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getSystemStatus = async (req, res, next) => {
  try {
    let database = { status: "connected", message: "Database query succeeded." };
    try {
      await sequelize.query("SELECT 1");
    } catch (error) {
      database = { status: "unavailable", message: "Database query failed." };
    }

    const configured = (...names) => names.every((name) => Boolean(process.env[name]));
    const environment = process.env.NODE_ENV || "development";

    res.status(database.status === "connected" ? 200 : 503).json({
      success: database.status === "connected",
      data: {
        checkedAt: new Date().toISOString(),
        environment,
        uptimeSeconds: Math.floor(process.uptime()),
        services: {
          api: { status: "available" },
          database,
          mediaUploads: {
            status: configured("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
              ? "configured"
              : "not_configured",
          },
          youtube: {
            status: configured("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")
              ? "configured"
              : "not_configured",
          },
          teams: {
            status: configured("TEAMS_TENANT_ID", "TEAMS_CLIENT_ID", "TEAMS_CLIENT_SECRET", "TEAMS_ORGANIZER_EMAIL")
              ? (process.env.TEAMS_LIVE_ENABLED === "true" ? "enabled" : "configured_disabled")
              : "not_configured",
            workerEnabled: process.env.TEAMS_LIVE_WORKER_ENABLED === "true",
          },
        },
        security: {
          jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
          corsAllowlistConfigured: Boolean(process.env.ALLOWED_FRONTEND_ORIGINS),
          productionMode: environment === "production",
        },
        commercial: {
          freeMarketplaceTrialEnabled: process.env.FREE_TRIAL_ENABLED === "true",
          freeMarketplaceTrialEndDate: process.env.FREE_TRIAL_END_DATE || null,
          payHere: {
            configured: configured("PAYHERE_MERCHANT_ID", "PAYHERE_MERCHANT_SECRET"),
            mode: process.env.PAYHERE_MODE || "sandbox",
          },
          helaPay: {
            configured: configured("HELAPAY_API_KEY", "HELAPAY_MERCHANT_ID"),
            mode: process.env.HELAPAY_MODE || "sandbox",
          },
          bankTransferConfigured: configured("BANK_NAME", "BANK_ACCOUNT_NUMBER", "BANK_ACCOUNT_NAME"),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSupportTickets,
  getSupportTicket,
  updateSupportTicket,
  bulkUpdateSupportTickets,
  getAdminAuditLogs,
  getSystemStatus,
};
