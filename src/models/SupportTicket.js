const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const SupportTicket = sequelize.define(
  "SupportTicket",
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
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255],
      },
    },
    category: {
      type: DataTypes.ENUM(
        "technical",
        "account",
        "course",
        "enrollment",
        "payment",
        "marketplace",
        "feature",
        "other",
      ),
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "critical"),
      allowNull: false,
      defaultValue: "medium",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [20, 5000],
      },
    },
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array of Cloudinary attachment URLs",
    },
    status: {
      type: DataTypes.ENUM("open", "in_progress", "resolved", "closed"),
      allowNull: false,
      defaultValue: "open",
    },
    assignedToAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_to_admin_id",
    },
    adminResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "admin_response",
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "responded_at",
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "resolved_at",
    },
    lastUpdatedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "last_updated_by_admin_id",
    },
  },
  {
    tableName: "support_tickets",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      { fields: ["assigned_to_admin_id"] },
    ],
  },
);

module.exports = SupportTicket;
