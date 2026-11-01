const { AdminAuditLog } = require("../models");

const auditAdminAction = (action, targetType, summary) => (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const isAdmin = roles.includes("admin") || req.user?.primaryRole === "admin";
  if (!isAdmin) return next();

  res.on("finish", async () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || !req.user) return;

    try {
      const allowedDetailKeys = [
        "reason",
        "rejectionReason",
        "status",
        "priority",
        "isActive",
        "isVerified",
        "approved",
        "assignToMe",
      ];
      // Never persist a credential or token that reached us in a query
      // string. Auth data belongs in a POST body, but a mis-built link or a
      // form that submitted before hydration can still put it in the URL, and
      // the audit log is long-lived storage.
      const SENSITIVE_QUERY_KEYS = /^(password|pass|pwd|token|access_token|refresh_token|secret|client_secret|api[-_]?key|code|otp|auth|authorization|session|email|username)$/i;
      const redactUrl = (originalUrl) => {
        const raw = String(originalUrl || "");
        const split = raw.indexOf("?");
        if (split === -1) return raw.slice(0, 500);
        const path = raw.slice(0, split);
        const params = new URLSearchParams(raw.slice(split + 1));
        for (const key of [...params.keys()]) {
          if (SENSITIVE_QUERY_KEYS.test(key)) params.set(key, "[redacted]");
        }
        const query = params.toString();
        return (query ? `${path}?${query}` : path).slice(0, 500);
      };

      const changes = Object.fromEntries(
        allowedDetailKeys
          .filter((key) => req.body?.[key] !== undefined)
          .map((key) => [key, String(req.body[key]).slice(0, 500)]),
      );

      await AdminAuditLog.create({
        actorAdminId: req.user.id,
        action,
        targetType,
        targetId: req.params.id || req.params.contentId || null,
        summary: typeof summary === "function" ? summary(req) : summary,
        metadata: {
          method: req.method,
          path: redactUrl(req.originalUrl),
          statusCode: res.statusCode,
          ...(Array.isArray(req.body?.ticketIds)
            ? { itemCount: Math.min(req.body.ticketIds.length, 50) }
            : {}),
          ...(Object.keys(changes).length > 0 ? { changes } : {}),
        },
        ipAddress: req.ip || null,
        userAgent: String(req.get("user-agent") || "").slice(0, 500) || null,
      });
    } catch (error) {
      console.error("Failed to write admin audit log:", error.message);
    }
  });

  next();
};
//vv
module.exports = { auditAdminAction };
