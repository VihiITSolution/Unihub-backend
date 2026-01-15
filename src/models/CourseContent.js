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
  },
  {
    tableName: "course_contents",
    timestamps: true,
    underscored: true,
  }
);

module.exports = CourseContent;
