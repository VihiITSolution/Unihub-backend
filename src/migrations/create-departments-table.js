require("dotenv").config();
const { sequelize } = require("../models");

const createDepartmentsTable = async () => {
  try {
    console.log("Creating departments table...");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        faculty_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(150),
        is_active BOOLEAN DEFAULT TRUE,
        \`order\` INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_faculty_dept (faculty_id, name),
        INDEX idx_faculty_id (faculty_id),
        INDEX idx_active (\`order\`, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ departments table created");

    // Add department_id column to courses if not already present
    try {
      await sequelize.query(`
        ALTER TABLE courses
        ADD COLUMN IF NOT EXISTS department_id INT,
        ADD CONSTRAINT fk_courses_department
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      `);
      console.log("✓ Added department_id to courses table");
    } catch (err) {
      console.log("ℹ courses.department_id column/FK may already exist");
    }

    console.log("\n✅ Departments migration completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) console.error("DB error:", error.original.message);
    process.exit(1);
  }
};

createDepartmentsTable();
