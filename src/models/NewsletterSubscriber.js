const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const NewsletterSubscriber = sequelize.define(
  "NewsletterSubscriber",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
  },
  {
    tableName: "newsletter_subscribers",
    timestamps: true,
    underscored: true,
  }
);

module.exports = NewsletterSubscriber;
