const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliatePayoutProfile", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "user_id" },
  encryptedDetails: { type: DataTypes.JSON, allowNull: false, field: "encrypted_details" },
  accountHash: { type: DataTypes.STRING(64), allowNull: false, field: "account_hash" },
  accountMask: { type: DataTypes.STRING(32), allowNull: false, field: "account_mask" },
}, { tableName: "affiliate_payout_profiles", timestamps: true, underscored: true });
