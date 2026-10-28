const { MicrosoftDriveConnection } = require("../models");
const microsoftDrive = require("../services/microsoftDrive.service");

const safeConnection = (connection) => connection && ({
  connected: true,
  email: connection.email,
  displayName: connection.displayName,
  connectedAt: connection.connectedAt,
});

async function getStatus(req, res, next) {
  try {
    const connection = await MicrosoftDriveConnection.findOne({ where: { userId: req.user.id } });
    res.json({ success: true, data: { configured: microsoftDrive.configured(), connection: safeConnection(connection) || { connected: false } } });
  } catch (error) { next(error); }
}

async function authorize(req, res, next) {
  try {
    if (!microsoftDrive.configured()) {
      return res.status(503).json({ success: false, message: "Microsoft Drive import is not configured. Add the Microsoft OAuth environment variables first." });
    }
    res.json({ success: true, data: { authorizationUrl: microsoftDrive.authorizationUrl(req.user.id) } });
  } catch (error) { next(error); }
}

async function callback(req, res) {
  const finishUrl = `${String(process.env.ADMIN_APP_URL || "https://unihub.lk/admin").replace(/\/$/, "")}/courses?microsoftDrive`;
  try {
    if (req.query.error) throw new Error(`Microsoft sign-in was cancelled: ${req.query.error_description || req.query.error}`);
    const state = microsoftDrive.verifyState(req.query.state);
    if (!req.query.code) throw new Error("Microsoft did not return an authorization code");
    const tokens = await microsoftDrive.exchangeCode(req.query.code);
    if (!tokens.refresh_token) throw new Error("Microsoft did not provide offline access. Connect the account again and approve access.");
    const profile = await microsoftDrive.getProfile(tokens.access_token);
    const tenantId = tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")).tid || null : null;
    await MicrosoftDriveConnection.upsert({
      userId: state.userId,
      microsoftUserId: profile.id,
      tenantId,
      email: profile.mail || profile.userPrincipalName || null,
      displayName: profile.displayName || null,
      encryptedRefreshToken: microsoftDrive.encrypt(tokens.refresh_token),
      connectedAt: new Date(),
    });
    return res.redirect(`${finishUrl}=connected`);
  } catch (error) {
    console.error("Microsoft Drive OAuth callback failed:", error.message);
    return res.redirect(`${finishUrl}=error`);
  }
}

async function disconnect(req, res, next) {
  try {
    await MicrosoftDriveConnection.destroy({ where: { userId: req.user.id } });
    res.json({ success: true, message: "Microsoft account disconnected" });
  } catch (error) { next(error); }
}

module.exports = { getStatus, authorize, callback, disconnect };
