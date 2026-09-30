const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const VerificationChallenge = sequelize.define(
  "VerificationChallenge",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    purpose: {
      type: DataTypes.ENUM("registration_phone", "phone_change", "student_email", "password_reset_email"),
      allowNull: false,
    },
    destination: { type: DataTypes.STRING(255), allowNull: false },
    codeHash: { type: DataTypes.STRING(64), allowNull: false, field: "code_hash" },
    registrationPayload: { type: DataTypes.JSON, allowNull: true, field: "registration_payload" },
    userId: { type: DataTypes.INTEGER, allowNull: true, field: "user_id" },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
    lastSentAt: { type: DataTypes.DATE, allowNull: false, field: "last_sent_at" },
    sendCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "send_count" },
    attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "attempt_count" },
    consumedAt: { type: DataTypes.DATE, allowNull: true, field: "consumed_at" },
    ipHash: { type: DataTypes.STRING(64), allowNull: true, field: "ip_hash" },
  },
  { tableName: "verification_challenges", timestamps: true, underscored: true },
);

module.exports = VerificationChallenge;
