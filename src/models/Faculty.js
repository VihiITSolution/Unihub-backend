const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Faculty = sequelize.define(
  "Faculty",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    icon: {
      type: DataTypes.STRING(50),
      defaultValue: "🎓",
      comment: "Emoji or icon identifier for the faculty",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      field: "created_by",
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "faculties",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Faculty;
