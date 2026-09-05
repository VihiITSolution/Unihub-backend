const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliateLedgerEntry", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  campaignId: { type: DataTypes.INTEGER, allowNull: false, field: "campaign_id" },
  referralId: { type: DataTypes.INTEGER, allowNull: true, field: "referral_id" },
  payoutRequestId: { type: DataTypes.INTEGER, allowNull: true, field: "payout_request_id" },
  type: { type: DataTypes.ENUM("reward", "reservation", "release", "paid", "reversal"), allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { tableName: "affiliate_ledger_entries", timestamps: true, underscored: true });
