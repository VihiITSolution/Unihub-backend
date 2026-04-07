require("dotenv").config();
const { sequelize } = require("../models");

const createCategoriesTable = async () => {
  try {
    console.log("Creating categories table...");

    // Create the categories table directly using raw SQL
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_by_tutor_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by_tutor_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_name (name),
        INDEX idx_slug (slug),
        INDEX idx_created_by (created_by_tutor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("✓ Categories table created successfully");

    // Add columns to courses table if they don't exist
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN IF NOT EXISTS short_description VARCHAR(500),
        ADD COLUMN IF NOT EXISTS about_course TEXT,
        ADD COLUMN IF NOT EXISTS category_id INT,
        ADD FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      `);
      console.log("✓ Added new columns to courses table");
    } catch (err) {
      // Columns might already exist or FK might exist
      console.log("ℹ Courses table update (columns may already exist)");
    }

    // Seed default categories
    console.log("Seeding default categories...");
    const defaultCategories = [
      {
        name: "Programming",
        slug: "programming",
        description: "Programming languages and fundamentals",
      },
      {
        name: "Web Development",
        slug: "web-development",
        description: "Frontend and backend web development",
      },
      {
        name: "Data Science",
        slug: "data-science",
        description: "Data analysis, machine learning, and AI",
      },
      {
        name: "Mobile Development",
        slug: "mobile-development",
        description: "iOS, Android, and cross-platform apps",
      },
      {
        name: "Design",
        slug: "design",
        description: "UI/UX design, graphic design, and creative design",
      },
      {
        name: "Business",
        slug: "business",
        description: "Business strategy, entrepreneurship, and management",
      },
      {
        name: "Marketing",
        slug: "marketing",
        description: "Digital marketing, social media, and growth",
      },
      {
        name: "Mathematics",
        slug: "mathematics",
        description: "Mathematics, statistics, and calculus",
      },
      {
        name: "Personal Development",
        slug: "personal-development",
        description: "Soft skills and personal growth",
      },
    ];

    for (const category of defaultCategories) {
      await sequelize.query(
        `INSERT IGNORE INTO categories (name, slug, description, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, TRUE, NOW(), NOW())`,
        { replacements: [category.name, category.slug, category.description] },
      );
    }

    console.log("✓ Default categories seeded");

    console.log("\n✅ Categories table setup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("Database error:", error.original.message);
    }
    process.exit(1);
  }
};

createCategoriesTable();
