const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Enrollment = sequelize.define(
  "Enrollment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    learnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "learner_id",
      references: {
        model: "users",
        key: "id",
      },
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
    status: {
      type: DataTypes.ENUM("enrolled", "in_progress", "completed", "cancelled"),
      defaultValue: "enrolled",
    },
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100,
      },
      comment: "Progress percentage",
    },
    enrolledAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "enrolled_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      field: "completed_at",
    },
    completedContents: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "completed_contents",
      comment: "Array of completed course content IDs",
    },
  },
  {
    tableName: "enrollments",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["learner_id", "course_id"],
      },
    ],
  },
);

module.exports = Enrollment;
