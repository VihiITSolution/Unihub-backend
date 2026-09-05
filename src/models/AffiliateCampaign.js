const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliateCampaign", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "Asia/Colombo" },
  startsAt: { type: DataTypes.DATE, allowNull: false, field: "starts_at" },
  signupEndsAt: { type: DataTypes.DATE, allowNull: false, field: "signup_ends_at" },
  minimumRedemption: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5000, field: "minimum_redemption" },
  approvedReferralCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "approved_referral_count" },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  tierRules: { type: DataTypes.JSON, allowNull: false, field: "tier_rules" },
}, { tableName: "affiliate_campaigns", timestamps: true, underscored: true });
