const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

module.exports = sequelize.define("AffiliateReferral", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campaignId: { type: DataTypes.INTEGER, allowNull: false, field: "campaign_id" },
  referrerUserId: { type: DataTypes.INTEGER, allowNull: false, field: "referrer_user_id" },
  referredUserId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "referred_user_id" },
  referralCode: { type: DataTypes.STRING(32), allowNull: false, field: "referral_code" },
  status: { type: DataTypes.ENUM("registered", "activity_detected", "review", "available", "held", "rejected", "reversed"), allowNull: false, defaultValue: "registered" },
  activityType: { type: DataTypes.ENUM("course", "marketplace", "social"), allowNull: true, field: "activity_type" },
  activityResourceId: { type: DataTypes.INTEGER, allowNull: true, field: "activity_resource_id" },
  socialPostId: { type: DataTypes.INTEGER, allowNull: true, field: "social_post_id" },
  socialCommentId: { type: DataTypes.INTEGER, allowNull: true, field: "social_comment_id" },
  activityAt: { type: DataTypes.DATE, allowNull: true, field: "activity_at" },
  tierSequence: { type: DataTypes.INTEGER, allowNull: true, unique: true, field: "tier_sequence" },
  rewardAmount: { type: DataTypes.INTEGER, allowNull: true, field: "reward_amount" },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: "approved_at" },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: "reviewed_by" },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: "rejection_reason" },
}, { tableName: "affiliate_referrals", timestamps: true, underscored: true, indexes: [{ fields: ["campaign_id", "referrer_user_id"] }, { fields: ["status"] }] });
