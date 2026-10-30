const { User } = require("../models");
const { createNotification } = require("../controllers/notificationController");
const { sendEmail } = require("./resend.service");

const EVENTS = new Set([
  "request_submitted",
  "approval_updated",
  "provisioning_failed",
  "schedule_changed",
  "cancelled",
]);

const isAdministrator = (user) =>
  user?.primaryRole === "admin" || (Array.isArray(user?.roles) && user.roles.includes("admin"));

function wantsEmail(user, event) {
  // Existing administrators receive the operational emails by default. They can
  // switch off the complete channel or individual event types in Admin > Administrators.
  const settings = user.notificationPrefs?.adminLiveSessions;
  if (!settings || settings.emailEnabled === undefined) return true;
  if (!settings.emailEnabled) return false;
  return settings.events?.[event] !== false;
}

async function notifyAdministrators({ event, title, message, link, sessionId }) {
  if (!EVENTS.has(event)) throw new Error(`Unknown live-session notification event: ${event}`);

  const users = await User.findAll({
    where: { isActive: true },
    attributes: ["id", "firstName", "email", "roles", "primaryRole", "notificationPrefs"],
  });
  const administrators = users.filter(isAdministrator);
  const metadata = { category: "live_session", event, sessionId };

  await Promise.allSettled(administrators.map((administrator) => createNotification(
    administrator.id,
    "general",
    title,
    message,
    link,
    metadata,
  )));

  await Promise.allSettled(administrators
    .filter((administrator) => administrator.email && wantsEmail(administrator, event))
    .map((administrator) => sendEmail(
      administrator.email,
      `[UniHub] ${title}`,
      [
        `Hi ${administrator.firstName || "there"},`,
        "",
        message,
        link ? `Open UniHub Admin: ${link}` : null,
        "",
        "You can change your live-session email notifications in UniHub Admin > Administrators.",
      ].filter(Boolean).join("\n"),
    )));
}

module.exports = { EVENTS, notifyAdministrators };
