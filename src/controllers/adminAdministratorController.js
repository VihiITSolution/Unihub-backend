const { User } = require("../models");
const { sendTestEmail, deliveryError } = require("../services/adminLiveSessionNotification.service");
const { APPROVAL_EVENTS } = require("../services/adminApprovalPreferences");

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

function sanitizeNotificationPrefs(input, current, eventTypes, preferenceKey) {
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
  for (const event of eventTypes) {
    if (typeof input.events?.[event] !== "boolean") {
      const error = new Error(`Choose whether to receive ${event} emails.`);
      error.statusCode = 400;
      throw error;
    }
    events[event] = input.events[event];
  }
  return {
    ...(current && typeof current === "object" ? current : {}),
    [preferenceKey]: { emailEnabled, events },
  };
}

async function list(req, res, next) {
  try {
    const users = await User.findAll({
      attributes: ["id", "firstName", "lastName", "email", "roles", "primaryRole", "isActive", "notificationPrefs", "createdAt", "lastLogin"],
      order: [["firstName", "ASC"], ["lastName", "ASC"]],
    });
    res.json({ success: true, data: { administrators: users.filter(isAdministrator).map(publicAdministrator), liveSessionEvents: LIVE_SESSION_EVENTS, approvalEvents: APPROVAL_EVENTS } });
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
    const { isActive, hasAdminAccess, liveSessionNotifications, approvalNotifications } = req.body;
    if (isActive === undefined && hasAdminAccess === undefined && liveSessionNotifications === undefined && approvalNotifications === undefined) {
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

    let prefs = user.notificationPrefs;
    if (liveSessionNotifications !== undefined) prefs = sanitizeNotificationPrefs(liveSessionNotifications, prefs, LIVE_SESSION_EVENTS, "adminLiveSessions");
    if (approvalNotifications !== undefined) prefs = sanitizeNotificationPrefs(approvalNotifications, prefs, APPROVAL_EVENTS, "adminApprovals");
    if (isActive !== undefined) user.isActive = isActive;
    if (hasAdminAccess === false) {
      user.roles = (Array.isArray(user.roles) ? user.roles : []).filter((role) => role !== "admin");
      user.primaryRole = user.roles.includes("tutor") ? "tutor" : user.roles.includes("vendor") ? "vendor" : "student";
    }
    if (liveSessionNotifications !== undefined || approvalNotifications !== undefined) user.notificationPrefs = prefs;
    await user.save();
    res.json({ success: true, message: "Administrator updated.", data: { administrator: publicAdministrator(user) } });
  } catch (error) { next(error); }
}

async function sendNotificationTest(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "firstName", "email", "roles", "primaryRole", "isActive"],
    });
    if (!user || !isAdministrator(user)) return res.status(404).json({ success: false, message: "Administrator not found." });
    if (!user.isActive) return res.status(409).json({ success: false, message: "Activate this administrator before sending a test email." });

    try {
      await sendTestEmail(user);
    } catch (error) {
      console.error(`Failed to send administrator notification test email to ${user.id} (${user.email}): ${deliveryError(error)}`);
      return res.status(502).json({ success: false, message: "Email could not be delivered. Check the backend logs and Resend sender-domain settings." });
    }
    res.json({ success: true, message: `Test email sent to ${user.email}.` });
  } catch (error) { next(error); }
}

module.exports = { list, add, update, sendNotificationTest, LIVE_SESSION_EVENTS };
