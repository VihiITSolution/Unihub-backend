const axios = require("axios");

async function sendStudentEmailVerification(email, code) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Student email verification is not configured");
  }

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Your UniHub student email verification code",
      text: `Your UniHub student email verification code is ${code}. It expires in 10 minutes.`,
    },
    {
      timeout: Number(process.env.RESEND_TIMEOUT_MS || 10000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function sendPasswordResetCode(email, code) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Password reset email is not configured");
  }

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Your UniHub password reset code",
      text: `Your UniHub password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
    },
    {
      timeout: Number(process.env.RESEND_TIMEOUT_MS || 10000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function sendApprovalEmail(email, subject, text) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Approval email is not configured");
  }

  await axios.post(
    "https://api.resend.com/emails",
    { from: process.env.EMAIL_FROM, to: [email], subject, text },
    {
      timeout: Number(process.env.RESEND_TIMEOUT_MS || 10000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
}

// Microsoft sends its own B2B invitation mail, but delivery is unreliable:
// it is frequently filtered as spam, and some tenants suppress it entirely.
// Students cannot join a session until the invitation is redeemed, so send a
// branded copy of the redeem link ourselves rather than depending on it.
async function sendTeamsInvitationEmail(email, name, redeemUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Teams invitation email is not configured");
  }

  const greeting = name ? `Hi ${name},` : "Hi,";

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Set up Microsoft Teams for your UniHub sessions",
      text: [
        greeting,
        "",
        "UniHub live sessions run on Microsoft Teams. Before your first session,",
        "open the link below and accept the invitation using this email address:",
        "",
        redeemUrl,
        "",
        "You only need to do this once. After that you can join any session you",
        "enrol in straight from UniHub.",
        "",
        "If you were not expecting this, you can ignore this email.",
      ].join("\n"),
    },
    {
      timeout: Number(process.env.RESEND_TIMEOUT_MS || 10000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
}

module.exports = { sendStudentEmailVerification, sendPasswordResetCode, sendApprovalEmail, sendTeamsInvitationEmail };
