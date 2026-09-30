const { User } = require("../models");
const { sendApprovalEmail } = require("./resend.service");

const approvalMessages = {
  course: { subject: "Your UniHub course was approved", detail: "Your course is approved and published." },
  marketplace: { subject: "Your UniHub marketplace listing was approved", detail: "Your marketplace listing is approved and available." },
  tutor: { subject: "Your UniHub tutor application was approved", detail: "Your tutor application is approved. You can now use your tutor account." },
  boarding: { subject: "Your UniHub boarding listing was approved", detail: "Your boarding listing is approved and available." },
  liveSession: { subject: "Your UniHub live session was approved", detail: "Your live session request is approved and is being prepared." },
  affiliateReferral: { subject: "Your UniHub referral was approved", detail: "Your affiliate referral reward is approved and available." },
  affiliatePayout: { subject: "Your UniHub payout request was approved", detail: "Your affiliate payout request is approved. You will be notified when it is paid." },
  bankTransfer: { subject: "Your UniHub bank transfer was verified", detail: "Your bank transfer has been verified. Any related listing may still need a separate approval." },
};

// An email provider outage must not undo an approval that has already been saved.
async function notifyApprovalByEmail(userId, kind, title) {
  try {
    const message = approvalMessages[kind];
    if (!message) throw new Error("Unknown approval type");
    const user = await User.findByPk(userId, { attributes: ["email", "firstName"] });
    if (!user?.email) throw new Error("Approval recipient has no email address");
    const name = String(user.firstName || "there").replace(/\s+/g, " ").trim();
    const safeTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 150);
    const text = [
      `Hi ${name},`,
      "",
      safeTitle ? `${message.detail} (${safeTitle})` : message.detail,
      "",
      "Sign in to UniHub to view the details.",
      "",
      "UniHub",
    ].join("\n");
    await sendApprovalEmail(user.email, message.subject, text);
    return true;
  } catch (error) {
    console.error(`Failed to send ${kind} approval email:`, error.message);
    return false;
  }
}

module.exports = { notifyApprovalByEmail };
