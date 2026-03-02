/**
 * Migration: Add Faculty table and update Course table
 * - Creates faculties table
 * - Adds faculty_id and year columns to courses table
 * - Pre-populates default faculties
 */

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create faculties table
    await queryInterface.createTable("faculties", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      icon: {
        type: DataTypes.STRING(50),
        defaultValue: "🎓",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        references: {
          model: "users",
          key: "id",
        },
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add faculty_id to courses table
    await queryInterface.addColumn("courses", "faculty_id", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "faculties",
        key: "id",
      },
      after: "description", // MySQL specific
    });

    // Add year column to courses table
    await queryInterface.addColumn("courses", "year", {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 4,
      },
      after: "faculty_id", // MySQL specific
    });

    // Insert default faculties
    await queryInterface.bulkInsert("faculties", [
      {
        name: "Faculty of Computing",
        icon: "💻",
        description: "Computer Science, Software Engineering, IT",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: "Faculty of Engineering",
        icon: "⚙️",
        description: "Mechanical, Electrical, Civil Engineering",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: "Faculty of Science",
        icon: "🔬",
        description: "Physics, Chemistry, Biology, Mathematics",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: "Faculty of Medicine",
        icon: "🩺",
        description: "Medical Sciences, Healthcare",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: "Faculty of Business & Management",
        icon: "💼",
        description: "Business, Management, Economics",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: "Faculty of Arts & Humanities",
        icon: "📚",
        description: "Languages, History, Philosophy, Literature",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log("✓ Faculty table created and default faculties added");
    console.log("✓ Course table updated with faculty_id and year columns");
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns from courses table
    await queryInterface.removeColumn("courses", "year");
    await queryInterface.removeColumn("courses", "faculty_id");

    // Drop faculties table
    await queryInterface.dropTable("faculties");

    console.log("✓ Reverted faculty migration");
  },
};
