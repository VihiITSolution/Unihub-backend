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

module.exports = { sendStudentEmailVerification };
