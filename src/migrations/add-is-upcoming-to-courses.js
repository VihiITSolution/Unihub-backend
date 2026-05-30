"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("courses", "is_upcoming", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment:
        "Mark course as upcoming - students can enroll but cannot access content",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("courses", "is_upcoming");
  },
};
