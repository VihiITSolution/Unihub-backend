const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const LiveSessionEvent = sequelize.define("LiveSessionEvent", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  sessionId: { type: DataTypes.INTEGER, allowNull: false, field: "session_id" },
  actorUserId: { type: DataTypes.INTEGER, allowNull: true, field: "actor_user_id" },
  type: { type: DataTypes.STRING(100), allowNull: false },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { tableName: "live_session_events", timestamps: true, createdAt: true, updatedAt: false, underscored: true, indexes: [{ fields: ["session_id", "created_at"] }] });

module.exports = LiveSessionEvent;
