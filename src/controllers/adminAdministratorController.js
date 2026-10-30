const { User } = require("../models");

const LIVE_SESSION_EVENTS = [
  "request_submitted",
  "approval_updated",
  "provisioning_failed",
  "schedule_changed",
  "cancelled",
];

const isAdministrator = (user) =>
  user?.primaryRole === "admin" || (Array.isArray(user?.roles) && user.roles.includes("admin"));

const publicAdministrator = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  roles: user.roles || [],
  primaryRole: user.primaryRole,
  isActive: user.isActive,
  notificationPrefs: user.notificationPrefs || null,
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
});

async function activeAdministratorCount(excludingUserId = null) {
  const users = await User.findAll({ where: { isActive: true }, attributes: ["id", "roles", "primaryRole"] });
  return users.filter((user) => user.id !== excludingUserId && isAdministrator(user)).length;
}

function sanitizeNotificationPrefs(input, current) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Notification settings must be an object.");
    error.statusCode = 400;
    throw error;
  }
  const emailEnabled = input.emailEnabled;
  if (typeof emailEnabled !== "boolean") {
    const error = new Error("Email notification setting must be true or false.");
    error.statusCode = 400;
    throw error;
  }
  const events = {};
  for (const event of LIVE_SESSION_EVENTS) {
    if (typeof input.events?.[event] !== "boolean") {
      const error = new Error(`Choose whether to receive ${event} emails.`);
      error.statusCode = 400;
      throw error;
    }
    events[event] = input.events[event];
  }
  return {
    ...(current && typeof current === "object" ? current : {}),
    adminLiveSessions: { emailEnabled, events },
  };
}

async function list(req, res, next) {
  try {
    const users = await User.findAll({
      attributes: ["id", "firstName", "lastName", "email", "roles", "primaryRole", "isActive", "notificationPrefs", "createdAt", "lastLogin"],
      order: [["firstName", "ASC"], ["lastName", "ASC"]],
    });
    res.json({ success: true, data: { administrators: users.filter(isAdministrator).map(publicAdministrator), liveSessionEvents: LIVE_SESSION_EVENTS } });
  } catch (error) { next(error); }
}

async function add(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "An existing user's email address is required." });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: "No UniHub account was found with that email address." });
    if (isAdministrator(user)) return res.status(409).json({ success: false, message: "This user already has administrator access." });

    user.roles = [...new Set([...(Array.isArray(user.roles) ? user.roles : []), "admin"])];
    user.primaryRole = "admin";
    await user.save();
    res.status(201).json({ success: true, message: "Administrator access granted.", data: { administrator: publicAdministrator(user) } });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user || !isAdministrator(user)) return res.status(404).json({ success: false, message: "Administrator not found." });
    const { isActive, hasAdminAccess, liveSessionNotifications } = req.body;
    if (isActive === undefined && hasAdminAccess === undefined && liveSessionNotifications === undefined) {
      return res.status(400).json({ success: false, message: "Provide an access or notification setting to update." });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") return res.status(400).json({ success: false, message: "Active status must be true or false." });
    if (hasAdminAccess !== undefined && typeof hasAdminAccess !== "boolean") return res.status(400).json({ success: false, message: "Administrator access must be true or false." });
    if ((isActive === false || hasAdminAccess === false) && Number(user.id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot remove your own administrator access." });
    }
    if (isActive === false || hasAdminAccess === false) {
      const remaining = await activeAdministratorCount(user.id);
      if (remaining < 1) return res.status(400).json({ success: false, message: "At least one active administrator must remain." });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (hasAdminAccess === false) {
      user.roles = (Array.isArray(user.roles) ? user.roles : []).filter((role) => role !== "admin");
      user.primaryRole = user.roles.includes("tutor") ? "tutor" : user.roles.includes("vendor") ? "vendor" : "student";
    }
    if (liveSessionNotifications !== undefined) user.notificationPrefs = sanitizeNotificationPrefs(liveSessionNotifications, user.notificationPrefs);
    await user.save();
    res.json({ success: true, message: "Administrator updated.", data: { administrator: publicAdministrator(user) } });
  } catch (error) { next(error); }
}

module.exports = { list, add, update, LIVE_SESSION_EVENTS };
