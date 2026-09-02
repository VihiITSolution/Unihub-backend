const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const LiveSessionProviderJob = sequelize.define("LiveSessionProviderJob", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  sessionId: { type: DataTypes.INTEGER, allowNull: false, field: "session_id" },
  type: { type: DataTypes.ENUM("provision", "attendee_sync", "artifact_sync", "cancel", "recording_delete"), allowNull: false },
  idempotencyKey: { type: DataTypes.STRING(255), allowNull: false, unique: true, field: "idempotency_key" },
  status: { type: DataTypes.ENUM("pending", "processing", "completed", "failed"), allowNull: false, defaultValue: "pending" },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  runAfter: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "run_after" },
  lockedAt: { type: DataTypes.DATE, allowNull: true, field: "locked_at" },
  payload: { type: DataTypes.JSON, allowNull: true },
  lastError: { type: DataTypes.STRING(500), allowNull: true, field: "last_error" },
}, { tableName: "live_session_provider_jobs", timestamps: true, underscored: true, indexes: [{ fields: ["status", "run_after"] }] });

module.exports = LiveSessionProviderJob;
