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

function deliveryError(error) {
  const providerMessage = error?.response?.data?.message
    || error?.response?.data?.error
    || error?.response?.data?.name;
  return providerMessage || error?.message || "Unknown email delivery error";
}

async function sendTestEmail(administrator) {
  if (!administrator?.email) throw new Error("Administrator has no email address");

  await sendEmail(
    administrator.email,
    "[UniHub] Administrator notification test",
    [
      `Hi ${administrator.firstName || "there"},`,
      "",
      "This is a test of your UniHub live-session administrator email notifications.",
      "If you received it, email delivery is configured correctly for this account.",
    ].join("\n"),
  );
}

// Callers await this so the email work is not abandoned when a deployed
// request runtime finishes handling the originating action.
async function notifyAdministrators({ event, title, message, link, sessionId }) {
  if (!EVENTS.has(event)) throw new Error(`Unknown live-session notification event: ${event}`);

  const users = await User.findAll({
    where: { isActive: true },
    attributes: ["id", "firstName", "email", "roles", "primaryRole", "notificationPrefs"],
  });
  const administrators = users.filter(isAdministrator);
  const metadata = { category: "live_session", event, sessionId };

  const inAppResults = await Promise.allSettled(administrators.map((administrator) => createNotification(
    administrator.id,
    "general",
    title,
    message,
    link,
    metadata,
  )));

  const emailRecipients = administrators.filter((administrator) => administrator.email && wantsEmail(administrator, event));
  const emailResults = await Promise.allSettled(emailRecipients.map((administrator) => sendEmail(
      administrator.email,
      `[UniHub] ${title}`,
      [
        `Hi ${administrator.firstName || "there"},`,
        "",
        message,
        link ? `Open UniHub Admin: ${String(process.env.ADMIN_APP_URL || "https://unihub.lk/admin").replace(/\/+$/, "")}/${link.replace(/^\/+/, "")}` : null,
        "",
        "You can change your live-session email notifications in UniHub Admin > Administrators.",
      ].filter(Boolean).join("\n"),
    )));

  inAppResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Failed to create ${event} in-app notification for administrator ${administrators[index].id}: ${deliveryError(result.reason)}`);
    }
  });
  emailResults.forEach((result, index) => {
    if (result.status === "rejected") {
      const administrator = emailRecipients[index];
      console.error(`Failed to send ${event} email to administrator ${administrator.id} (${administrator.email}): ${deliveryError(result.reason)}`);
    }
  });

  return {
    administratorCount: administrators.length,
    emailAttempted: emailRecipients.length,
    emailSent: emailResults.filter((result) => result.status === "fulfilled").length,
    emailFailed: emailResults.filter((result) => result.status === "rejected").length,
  };
}

module.exports = { EVENTS, notifyAdministrators, sendTestEmail, deliveryError };
