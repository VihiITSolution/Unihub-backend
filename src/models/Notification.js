const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    type: {
      type: DataTypes.ENUM(
        "tutor_approved",
        "tutor_rejected",
        "course_approved",
        "course_rejected",
        "enrollment",
        "payment",
        "general",
      ),
      allowNull: false,
      comment: "Type of notification",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Notification title",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Notification message content",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_read",
      comment: "Whether notification has been read",
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Optional link to related resource",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional metadata as JSON",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "read_at",
      comment: "Timestamp when notification was read",
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "notifications",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id"],
      },
      {
        fields: ["is_read"],
      },
      {
        fields: ["created_at"],
      },
    ],
  },
);

module.exports = Notification;
