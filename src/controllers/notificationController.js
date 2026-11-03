const { Notification, User } = require("../models");
const { sendEmail } = require("../services/resend.service");

/**
 * Get user's notifications
 */
const getUserNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (unreadOnly === "true") {
      where.isRead = false;
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.update({
      isRead: true,
      readAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId: req.user.id,
          isRead: false,
        },
      },
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.destroy();

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a notification (internal use or admin)
 */
const createNotification = async (
  userId,
  type,
  title,
  message,
  link = null,
  metadata = null,
) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      metadata,
    });
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Notify every active administrator about a new item in an operational queue.
 * This is deliberately best-effort; an unread-notification failure must never
 * prevent a student or vendor from completing their request.
 */
const notifyActiveAdmins = async (title, message, link = null, metadata = null, { email = false } = {}) => {
  const users = await User.findAll({
    where: { isActive: true },
    attributes: ["id", "firstName", "email", "roles", "primaryRole"],
  });
  const admins = users.filter((user) => user.primaryRole === "admin" || (Array.isArray(user.roles) && user.roles.includes("admin")));

  const adminUrl = String(process.env.ADMIN_APP_URL || "https://unihub.lk/admin").replace(/\/+$/, "");
  await Promise.all(admins.map(async (admin) => {
    const tasks = [createNotification(admin.id, "general", title, message, link, metadata)];
    if (email && admin.email) {
      tasks.push(sendEmail(admin.email, `[UniHub] ${title}`, [
        `Hi ${admin.firstName || "there"},`, "", message, "",
        link ? `Review in UniHub Admin: ${adminUrl}/${link.replace(/^\/+/, "")}` : `Open UniHub Admin: ${adminUrl}`,
      ].join("\n")));
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const reason = result.reason?.response?.data?.message || result.reason?.message || "Unknown error";
        console.error(`Failed to send administrator ${index === 0 ? "in-app notification" : "approval email"} to user ${admin.id}: ${reason}`);
      }
    });
  }));
  return admins.length;
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  notifyActiveAdmins,
};
