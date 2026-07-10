const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const BlockedMessageLog = sequelize.define(
  "BlockedMessageLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "conversation_id",
      references: {
        model: "conversations",
        key: "id",
      },
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "sender_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    attemptedBody: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "attempted_body",
      comment: "Raw rejected text, for admin review",
    },
    matchedPatterns: {
      type: DataTypes.JSON,
      allowNull: false,
      field: "matched_patterns",
      comment: "e.g. [\"phone_number\", \"whatsapp_keyword\"]",
    },
    reviewedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reviewed_by_admin_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
  },
  {
    tableName: "blocked_message_logs",
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [
      {
        fields: ["conversation_id"],
      },
      {
        fields: ["sender_id"],
      },
      {
        fields: ["created_at"],
      },
    ],
  },
);

module.exports = BlockedMessageLog;
