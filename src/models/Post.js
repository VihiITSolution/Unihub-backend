const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Post = sequelize.define(
  "Post",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    body: { type: DataTypes.TEXT },
    media: { type: DataTypes.JSON },
    visibility: {
      type: DataTypes.ENUM("public", "followers"),
      allowNull: false,
      defaultValue: "public",
    },
    likeCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "like_count" },
    commentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "comment_count" },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_deleted" },
  },
  { tableName: "posts", timestamps: true, underscored: true },
);

module.exports = Post;
