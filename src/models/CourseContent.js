const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const CourseContent = sequelize.define(
  "CourseContent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "course_id",
      references: {
        model: "courses",
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("video", "pdf"),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "YouTube URL for videos, file path for PDFs",
    },
    youtubeVideoId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "youtube_video_id",
      comment: "YouTube video ID for unlisted videos",
    },
    youtubeRightsDeclarationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "youtube_rights_declaration_id",
      references: {
        model: "youtube_rights_declarations",
        key: "id",
      },
      comment: "Signed declaration covering an externally linked YouTube video",
    },
    youtubeRightsConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "youtube_rights_confirmed_at",
      comment: "When the tutor confirmed rights for this linked video",
    },
    duration: {
      type: DataTypes.INTEGER,
      comment: "Duration in minutes for videos",
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Display order of content",
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_published",
    },
    isPreview: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_preview",
      comment:
        "Whether this material can be previewed by non-enrolled students",
    },
  },
  {
    tableName: "course_contents",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CourseContent;
