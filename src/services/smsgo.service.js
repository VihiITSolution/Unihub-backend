const axios = require("axios");
const { smsgoRecipient } = require("../utils/phone");

const timeout = Number(process.env.SMSGO_TIMEOUT_MS || 10000);
const baseUrl = () => (process.env.SMSGO_API_BASE_URL || "https://smsgo.lk").replace(/\/$/, "");

async function sendVerificationSms(phoneNumber, code) {
  if (!process.env.SMSGO_API_KEY) {
    throw new Error("SMS verification is not configured");
  }

  await axios.post(
    `${baseUrl()}/api/v1/sms/send`,
    {
      to: smsgoRecipient(phoneNumber),
      message: `UniHub verification code: ${code}. It expires in 10 minutes.`,
      mask: process.env.SMSGO_MASK || "SMSGo",
    },
    {
      timeout,
      headers: { "X-API-Key": process.env.SMSGO_API_KEY },
    },
  );
}

module.exports = { sendVerificationSms };
