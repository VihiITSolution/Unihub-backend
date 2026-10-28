const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const MicrosoftDriveConnection = sequelize.define("MicrosoftDriveConnection", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "user_id", references: { model: "users", key: "id" } },
  microsoftUserId: { type: DataTypes.STRING(255), allowNull: false, field: "microsoft_user_id" },
  tenantId: { type: DataTypes.STRING(255), allowNull: true, field: "tenant_id" },
  email: { type: DataTypes.STRING(255), allowNull: true },
  displayName: { type: DataTypes.STRING(255), allowNull: true, field: "display_name" },
  encryptedRefreshToken: { type: DataTypes.TEXT("long"), allowNull: false, field: "encrypted_refresh_token" },
  connectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "connected_at" },
}, { tableName: "microsoft_drive_connections", timestamps: true, underscored: true });

module.exports = MicrosoftDriveConnection;
