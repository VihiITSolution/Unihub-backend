const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Conversation = sequelize.define(
  "Conversation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    participantOneId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "participant_one_id",
      references: {
        model: "users",
        key: "id",
      },
      comment: "Always the lower user id of the pair (canonical ordering)",
    },
    participantTwoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "participant_two_id",
      references: {
        model: "users",
        key: "id",
      },
      comment: "Always the higher user id of the pair (canonical ordering)",
    },
    contextType: {
      type: DataTypes.ENUM(
        "general",
        "course",
        "marketplace_item",
        "boarding_place",
        "support",
      ),
      allowNull: false,
      defaultValue: "general",
      field: "context_type",
    },
    contextId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "context_id",
      comment: "Id of the course/item/boarding place, when applicable",
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_message_at",
    },
    lastMessagePreview: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "last_message_preview",
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_flagged",
    },
    flaggedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "flagged_by",
      references: {
        model: "users",
        key: "id",
      },
    },
    flaggedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "flagged_at",
    },
    flagReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "flag_reason",
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["participant_one_id", "participant_two_id"],
      },
      {
        fields: ["last_message_at"],
      },
      {
        fields: ["participant_one_id"],
      },
      {
        fields: ["participant_two_id"],
      },
    ],
  },
);

module.exports = Conversation;
