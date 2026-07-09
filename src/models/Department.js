const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Department = sequelize.define(
  "Department",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    facultyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "faculty_id",
      references: {
        model: "faculties",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "departments",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Department;
