const axios = require("axios");
const { smsgoRecipient } = require("../utils/phone");

const timeout = Number(process.env.SMSGO_TIMEOUT_MS || 10000);
const baseUrl = () => (process.env.SMSGO_API_BASE_URL || "https://smsgo.lk").replace(/\/$/, "");

async function sendVerificationSms(phoneNumber, code) {
  if (!process.env.SMSGO_API_KEY) {
    throw new Error("SMS verification is not configured");
  }

  try {
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
  } catch (cause) {
    // Do not log the API key, OTP, message body, or recipient. The status is
    // sufficient for administrators to correlate a provider failure.
    console.error("SMSGo verification request failed", {
      status: cause?.response?.status || null,
      code: cause?.code || null,
    });
    const error = new Error("Unable to send a verification SMS. Please try again later.");
    error.code = "SMSGO_DELIVERY_FAILED";
    throw error;
  }
}

module.exports = { sendVerificationSms };
