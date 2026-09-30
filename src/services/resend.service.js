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

module.exports = { sendStudentEmailVerification, sendPasswordResetCode, sendApprovalEmail };
