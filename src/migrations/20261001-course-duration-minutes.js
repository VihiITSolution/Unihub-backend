require("dotenv").config();
const sequelize = require("../config/sequelize");

async function migrate() {
  await sequelize.authenticate();
  const [columns] = await sequelize.query("SHOW COLUMNS FROM courses LIKE 'duration_minutes'");
  if (columns.length) {
    console.log("Course duration minutes column already exists");
    return;
  }

  await sequelize.query("ALTER TABLE courses ADD COLUMN duration_minutes INT NOT NULL DEFAULT 0 AFTER duration");
  console.log("Course duration minutes column added");
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error("Course duration minutes migration failed:", error.message);
  process.exit(1);
});
