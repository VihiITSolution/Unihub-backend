const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const YouTubeRightsDeclaration = sequelize.define(
  "YouTubeRightsDeclaration",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
      field: "user_id",
      references: { model: "users", key: "id" },
    },
    signatoryName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "signatory_name",
    },
    agreementVersion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "agreement_version",
    },
    agreementText: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      field: "agreement_text",
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "accepted_at",
    },
    acceptedIp: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: "accepted_ip",
    },
    acceptedUserAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "accepted_user_agent",
    },
  },
  {
    tableName: "youtube_rights_declarations",
    timestamps: true,
    underscored: true,
    updatedAt: false,
  },
);

module.exports = YouTubeRightsDeclaration;
