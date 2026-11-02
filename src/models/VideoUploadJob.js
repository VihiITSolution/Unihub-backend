const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

// A video that is on disk and waiting for YouTube quota. The file is already
// assembled and the CourseContent row already exists, so the learner-facing
// record is never blocked on YouTube: only the hosted URL is.
const VideoUploadJob = sequelize.define(
  "VideoUploadJob",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    contentId: { type: DataTypes.INTEGER, allowNull: false, field: "content_id" },
    filePath: { type: DataTypes.STRING(512), allowNull: false, field: "file_path" },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(1000), allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    runAfter: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "run_after",
    },
    lockedAt: { type: DataTypes.DATE, allowNull: true, field: "locked_at" },
    lastError: { type: DataTypes.STRING(500), allowNull: true, field: "last_error" },
  },
  {
    tableName: "video_upload_jobs",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["status", "run_after"] }, { fields: ["content_id"] }],
  },
);

module.exports = VideoUploadJob;
