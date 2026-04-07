"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("courses", "short_description", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "description",
    });
    await queryInterface.addColumn("courses", "about_course", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "short_description",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("courses", "short_description");
    await queryInterface.removeColumn("courses", "about_course");
  },
};
