const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Follow = sequelize.define(
  "Follow",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    followerId: { type: DataTypes.INTEGER, allowNull: false, field: "follower_id" },
    followingId: { type: DataTypes.INTEGER, allowNull: false, field: "following_id" },
  },
  {
    tableName: "follows",
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ["follower_id", "following_id"] }],
  },
);

module.exports = Follow;
