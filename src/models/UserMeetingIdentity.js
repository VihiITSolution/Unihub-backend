const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const UserMeetingIdentity = sequelize.define("UserMeetingIdentity", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  provider: { type: DataTypes.ENUM("teams"), allowNull: false, defaultValue: "teams" },
  email: { type: DataTypes.STRING(255), allowNull: false },
  entraGuestId: { type: DataTypes.STRING(255), allowNull: true, field: "entra_guest_id" },
  invitationRedeemUrl: { type: DataTypes.TEXT, allowNull: true, field: "invitation_redeem_url" },
  invitationStatus: { type: DataTypes.ENUM("not_invited", "pending", "accepted", "failed"), allowNull: false, defaultValue: "not_invited", field: "invitation_status" },
  lastError: { type: DataTypes.STRING(500), allowNull: true, field: "last_error" },
  lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
}, {
  tableName: "user_meeting_identities", timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ["user_id", "provider"] }, { fields: ["email"] }],
});

module.exports = UserMeetingIdentity;
