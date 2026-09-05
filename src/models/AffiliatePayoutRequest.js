const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliatePayoutRequest", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  campaignId: { type: DataTypes.INTEGER, allowNull: false, field: "campaign_id" },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM("pending", "approved", "paid", "rejected"), allowNull: false, defaultValue: "pending" },
  encryptedBankSnapshot: { type: DataTypes.JSON, allowNull: false, field: "encrypted_bank_snapshot" },
  accountMask: { type: DataTypes.STRING(32), allowNull: false, field: "account_mask" },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: "reviewed_by" },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: "reviewed_at" },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: "rejection_reason" },
  paidBy: { type: DataTypes.INTEGER, allowNull: true, field: "paid_by" },
  paidAt: { type: DataTypes.DATE, allowNull: true, field: "paid_at" },
  transferReference: { type: DataTypes.STRING(120), allowNull: true, field: "transfer_reference" },
}, { tableName: "affiliate_payout_requests", timestamps: true, underscored: true, indexes: [{ fields: ["user_id", "status"] }] });
