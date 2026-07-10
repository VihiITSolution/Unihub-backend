const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Message = sequelize.define(
  "Message",
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
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Nullable to allow attachment-only messages",
    },
    messageType: {
      type: DataTypes.ENUM("text", "attachment", "system"),
      allowNull: false,
      defaultValue: "text",
      field: "message_type",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_read",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "read_at",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_deleted",
    },
  },
  {
    tableName: "messages",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["conversation_id", "created_at"],
      },
      {
        fields: ["sender_id"],
      },
    ],
  },
);

module.exports = Message;
