const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Category = sequelize.define(
  "Category",
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
      comment: "Category name (e.g., Programming, Mathematics)",
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: "URL-friendly slug for category",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Category description",
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Category icon/image URL",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    createdByTutorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by_tutor_id",
      references: {
        model: "users",
        key: "id",
      },
      comment:
        "Tutor who created this custom category, null for system categories",
    },
  },
  {
    tableName: "categories",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Category;
