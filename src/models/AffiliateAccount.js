const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliateAccount", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "user_id" },
  referralCode: { type: DataTypes.STRING(32), allowNull: false, unique: true, field: "referral_code" },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
}, { tableName: "affiliate_accounts", timestamps: true, underscored: true });
