const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const CourseNotifyRequest = sequelize.define(
  "CourseNotifyRequest",
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
      references: { model: "users", key: "id" },
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "course_id",
      references: { model: "courses", key: "id" },
    },
  },
  {
    tableName: "course_notify_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["user_id", "course_id"] },
    ],
  }
);

module.exports = CourseNotifyRequest;
