const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const AdminAuditLog = sequelize.define(
  "AdminAuditLog",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    actorAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "actor_admin_id",
      references: { model: "users", key: "id" },
    },
    action: { type: DataTypes.STRING(100), allowNull: false },
    targetType: { type: DataTypes.STRING(50), allowNull: false, field: "target_type" },
    targetId: { type: DataTypes.STRING(100), allowNull: true, field: "target_id" },
    summary: { type: DataTypes.STRING(500), allowNull: false },
    metadata: { type: DataTypes.JSON, allowNull: true },
    ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: "ip_address" },
    userAgent: { type: DataTypes.STRING(500), allowNull: true, field: "user_agent" },
  },
  {
    tableName: "admin_audit_logs",
    timestamps: true,
    createdAt: true,
    updatedAt: false,
    underscored: true,
  },
);

module.exports = AdminAuditLog;
