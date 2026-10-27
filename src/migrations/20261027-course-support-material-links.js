require("dotenv").config();
const sequelize = require("../config/sequelize");

async function migrate() {
  await sequelize.authenticate();
  // MySQL ENUM values are stored in the table definition, so model sync alone
  // cannot reliably add this value on every production deployment.
  await sequelize.query(
    "ALTER TABLE course_contents MODIFY COLUMN type ENUM('video', 'pdf', 'link') NOT NULL",
  );
  console.log("Course support-material link type is ready");
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error("Course support-material migration failed:", error.message);
  process.exit(1);
});
