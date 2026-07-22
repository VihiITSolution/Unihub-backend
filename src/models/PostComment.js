const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const PostComment = sequelize.define(
  "PostComment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    postId: { type: DataTypes.INTEGER, allowNull: false, field: "post_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    body: { type: DataTypes.TEXT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_deleted" },
  },
  { tableName: "post_comments", timestamps: true, underscored: true },
);

module.exports = PostComment;
