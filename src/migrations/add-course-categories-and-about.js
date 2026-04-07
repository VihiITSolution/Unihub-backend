const { sequelize } = require("../models");

async function addCourseCategoriesAndAbout() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log("Adding categories table and course updates...");

    // Create categories table
    await queryInterface.createTable("categories", {
      id: {
        type: require("sequelize").DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: require("sequelize").DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      slug: {
        type: require("sequelize").DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: require("sequelize").DataTypes.TEXT,
        allowNull: true,
      },
      icon: {
        type: require("sequelize").DataTypes.STRING(255),
        allowNull: true,
      },
      is_active: {
        type: require("sequelize").DataTypes.BOOLEAN,
        defaultValue: true,
      },
      created_by_tutor_id: {
        type: require("sequelize").DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      created_at: {
        type: require("sequelize").DataTypes.DATE,
        allowNull: false,
        defaultValue: require("sequelize").DataTypes.NOW,
      },
      updated_at: {
        type: require("sequelize").DataTypes.DATE,
        allowNull: false,
        defaultValue: require("sequelize").DataTypes.NOW,
      },
    });

    console.log("✓ Categories table created");

    // Add new columns to courses table
    await queryInterface.addColumn("courses", "short_description", {
      type: require("sequelize").DataTypes.STRING(500),
      allowNull: true,
      comment: "Brief description shown on course listings",
    });

    console.log("✓ short_description column added to courses");

    await queryInterface.addColumn("courses", "about_course", {
      type: require("sequelize").DataTypes.TEXT,
      allowNull: true,
      comment:
        "Detailed course information including lessons, learning points, difficulty level, etc.",
    });

    console.log("✓ about_course column added to courses");

    await queryInterface.addColumn("courses", "category_id", {
      type: require("sequelize").DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "categories",
        key: "id",
      },
      comment: "Foreign key to categories table",
    });

    console.log("✓ category_id column added to courses");

    // Seed system categories so existing courses can be linked
    const { Category } = require("../models");

    const systemCategories = [
      {
        name: "Programming",
        slug: "programming",
        description: "Programming languages and concepts",
        is_active: true,
      },
      {
        name: "Web Development",
        slug: "web-development",
        description: "Web design and development",
        is_active: true,
      },
      {
        name: "Data Science",
        slug: "data-science",
        description: "Data analysis, machine learning, and statistics",
        is_active: true,
      },
      {
        name: "Mobile Development",
        slug: "mobile-development",
        description: "iOS, Android, and cross-platform mobile apps",
        is_active: true,
      },
      {
        name: "Design",
        slug: "design",
        description: "UI/UX, graphic design, and web design",
        is_active: true,
      },
      {
        name: "Business",
        slug: "business",
        description: "Business, entrepreneurship, and management",
        is_active: true,
      },
      {
        name: "Marketing",
        slug: "marketing",
        description: "Digital marketing and brand strategy",
        is_active: true,
      },
      {
        name: "Mathematics",
        slug: "mathematics",
        description: "Mathematics and quantitative topics",
        is_active: true,
      },
      {
        name: "Personal Development",
        slug: "personal-development",
        description: "Soft skills and personal growth",
        is_active: true,
      },
    ];

    await Category.bulkCreate(systemCategories, { ignoreDuplicates: true });
    console.log("✓ System categories seeded");

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

module.exports = addCourseCategoriesAndAbout;
