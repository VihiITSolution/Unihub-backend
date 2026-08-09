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
          path: req.originalUrl,
          statusCode: res.statusCode,
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

module.exports = { auditAdminAction };
