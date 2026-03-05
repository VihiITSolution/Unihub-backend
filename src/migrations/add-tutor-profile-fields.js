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
    await queryInterface.addColumn("tutor_profiles", "graduation_status", {
      type: Sequelize.ENUM("graduate", "undergraduate"),
      allowNull: true,
    });

    await queryInterface.addColumn("tutor_profiles", "courses_subjects", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn("tutor_profiles", "youtube_link", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("tutor_profiles", "blog_link", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("tutor_profiles", "linkedin_link", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("tutor_profiles", "remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    console.log("✅ Successfully added new fields to tutor_profiles table");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("tutor_profiles", "graduation_status");
    await queryInterface.removeColumn("tutor_profiles", "courses_subjects");
    await queryInterface.removeColumn("tutor_profiles", "youtube_link");
    await queryInterface.removeColumn("tutor_profiles", "blog_link");
    await queryInterface.removeColumn("tutor_profiles", "linkedin_link");
    await queryInterface.removeColumn("tutor_profiles", "remarks");

    // Drop the ENUM type if it exists
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_tutor_profiles_graduation_status;",
    );

    console.log("✅ Successfully removed new fields from tutor_profiles table");
  },
};
