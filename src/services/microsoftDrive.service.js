const axios = require("axios");
const crypto = require("crypto");

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const scopes = ["openid", "profile", "offline_access", "User.Read", "Files.Read"];

const configured = () => Boolean(
  process.env.MICROSOFT_DRIVE_CLIENT_ID &&
  process.env.MICROSOFT_DRIVE_CLIENT_SECRET &&
  process.env.MICROSOFT_DRIVE_REDIRECT_URI &&
  process.env.MICROSOFT_DRIVE_TOKEN_KEY &&
  process.env.MICROSOFT_DRIVE_STATE_SECRET,
);

const tenant = () => process.env.MICROSOFT_DRIVE_TENANT_ID || "organizations";
const authority = () => `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0`;

function tokenKey() {
  const value = Buffer.from(process.env.MICROSOFT_DRIVE_TOKEN_KEY || "", "base64");
  if (value.length !== 32) throw new Error("MICROSOFT_DRIVE_TOKEN_KEY must be a base64-encoded 32-byte key");
  return value;
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}

function decrypt(value) {
  const [iv, tag, ciphertext] = String(value || "").split(".");
  if (!iv || !tag || !ciphertext) throw new Error("The saved Microsoft connection is invalid. Connect the account again.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function signState(userId) {
  if (!configured()) throw new Error("Microsoft Drive import is not configured");
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 10 * 60 * 1000, nonce: crypto.randomUUID() })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.MICROSOFT_DRIVE_STATE_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(state) {
  const [payload, signature] = String(state || "").split(".");
  const expected = crypto.createHmac("sha256", process.env.MICROSOFT_DRIVE_STATE_SECRET || "").update(payload || "").digest("base64url");
  const receivedBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (!payload || !signature || receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) throw new Error("Microsoft sign-in request is invalid or expired");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!Number.isInteger(decoded.userId) || decoded.expiresAt < Date.now()) throw new Error("Microsoft sign-in request is invalid or expired");
  return decoded;
}

function authorizationUrl(userId) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_DRIVE_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MICROSOFT_DRIVE_REDIRECT_URI,
    response_mode: "query",
    scope: scopes.join(" "),
    state: signState(userId),
    prompt: "select_account",
  });
  return `${authority()}/authorize?${params}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_DRIVE_CLIENT_ID,
    client_secret: process.env.MICROSOFT_DRIVE_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MICROSOFT_DRIVE_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const response = await axios.post(`${authority()}/token`, body.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20_000 });
  return response.data;
}

async function getProfile(accessToken) {
  const response = await axios.get(`${GRAPH_ROOT}/me?$select=id,displayName,mail,userPrincipalName`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20_000 });
  return response.data;
}

async function accessTokenFor(connection) {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_DRIVE_CLIENT_ID,
    client_secret: process.env.MICROSOFT_DRIVE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: scopes.join(" "),
  });
  try {
    const response = await axios.post(`${authority()}/token`, body.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20_000 });
    if (response.data.refresh_token) {
      connection.encryptedRefreshToken = encrypt(response.data.refresh_token);
      await connection.save();
    }
    return response.data.access_token;
  } catch (error) {
    const authError = error.response?.status === 400 || error.response?.status === 401;
    const message = authError ? "Your Microsoft connection expired or was revoked. Connect the account again." : "Unable to access Microsoft OneDrive right now.";
    const wrapped = new Error(message);
    wrapped.statusCode = authError ? 401 : 502;
    throw wrapped;
  }
}

module.exports = { configured, encrypt, verifyState, authorizationUrl, exchangeCode, getProfile, accessTokenFor };
