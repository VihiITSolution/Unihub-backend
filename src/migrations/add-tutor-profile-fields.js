/**
 * Migration: Add new fields to tutor_profiles table
 *
 * This migration adds the following fields:
 * - graduationStatus: ENUM for graduation status
 * - coursesSubjects: JSON array for subjects the tutor will teach
 * - youtubeLink: Portfolio YouTube channel/video link
 * - blogLink: Portfolio blog/website link
 * - linkedinLink: Portfolio LinkedIn profile link
 * - remarks: Additional remarks from the tutor
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("tutor_profiles", "graduationStatus", {
      type: Sequelize.ENUM("graduate", "undergraduate"),
      allowNull: true,
      after: "qualifications",
    });

    await queryInterface.addColumn("tutor_profiles", "coursesSubjects", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: "[]",
      after: "expertiseAreas",
    });

    await queryInterface.addColumn("tutor_profiles", "youtubeLink", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "coursesSubjects",
    });

    await queryInterface.addColumn("tutor_profiles", "blogLink", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "youtubeLink",
    });

    await queryInterface.addColumn("tutor_profiles", "linkedinLink", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "blogLink",
    });

    await queryInterface.addColumn("tutor_profiles", "remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "bio",
    });

    console.log("✅ Successfully added new fields to tutor_profiles table");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("tutor_profiles", "graduationStatus");
    await queryInterface.removeColumn("tutor_profiles", "coursesSubjects");
    await queryInterface.removeColumn("tutor_profiles", "youtubeLink");
    await queryInterface.removeColumn("tutor_profiles", "blogLink");
    await queryInterface.removeColumn("tutor_profiles", "linkedinLink");
    await queryInterface.removeColumn("tutor_profiles", "remarks");

    // Drop the ENUM type if it exists
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_tutor_profiles_graduationStatus;",
    );

    console.log("✅ Successfully removed new fields from tutor_profiles table");
  },
};
