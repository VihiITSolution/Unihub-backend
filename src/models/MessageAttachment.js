const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const MessageAttachment = sequelize.define(
  "MessageAttachment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "message_id",
      references: {
        model: "messages",
        key: "id",
      },
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "Cloudinary secure_url",
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "public_id",
      comment: "Cloudinary public id",
    },
    fileType: {
      type: DataTypes.ENUM("image", "video", "document"),
      allowNull: false,
      field: "file_type",
    },
    originalFilename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "original_filename",
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "mime_type",
    },
    fileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "file_size_bytes",
    },
  },
  {
    tableName: "message_attachments",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["message_id"],
      },
    ],
  },
);

module.exports = MessageAttachment;
