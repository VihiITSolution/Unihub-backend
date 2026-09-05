const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliateRiskFlag", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  referralId: { type: DataTypes.INTEGER, allowNull: true, field: "referral_id" },
  payoutRequestId: { type: DataTypes.INTEGER, allowNull: true, field: "payout_request_id" },
  type: { type: DataTypes.STRING(80), allowNull: false },
  status: { type: DataTypes.ENUM("open", "cleared", "confirmed"), allowNull: false, defaultValue: "open" },
  details: { type: DataTypes.JSON, allowNull: true },
  resolvedBy: { type: DataTypes.INTEGER, allowNull: true, field: "resolved_by" },
  resolvedAt: { type: DataTypes.DATE, allowNull: true, field: "resolved_at" },
}, { tableName: "affiliate_risk_flags", timestamps: true, underscored: true });
