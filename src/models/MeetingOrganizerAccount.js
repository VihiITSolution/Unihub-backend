const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const MeetingOrganizerAccount = sequelize.define("MeetingOrganizerAccount", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.ENUM("teams"), allowNull: false, defaultValue: "teams" },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  entraUserId: { type: DataTypes.STRING(255), allowNull: true, field: "entra_user_id" },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  healthStatus: { type: DataTypes.ENUM("unknown", "healthy", "unhealthy"), allowNull: false, defaultValue: "unknown", field: "health_status" },
  lastHealthCheckAt: { type: DataTypes.DATE, allowNull: true, field: "last_health_check_at" },
  healthMessage: { type: DataTypes.STRING(500), allowNull: true, field: "health_message" },
}, { tableName: "meeting_organizer_accounts", timestamps: true, underscored: true });

module.exports = MeetingOrganizerAccount;
