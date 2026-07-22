const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const PostLike = sequelize.define(
  "PostLike",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    postId: { type: DataTypes.INTEGER, allowNull: false, field: "post_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  },
  {
    tableName: "post_likes",
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ["post_id", "user_id"] }],
  },
);

module.exports = PostLike;
