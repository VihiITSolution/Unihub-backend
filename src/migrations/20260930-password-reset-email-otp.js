require("dotenv").config();
const { sequelize } = require("../models");

const NAME = "20260930-password-reset-email-otp";

async function migrate() {
  await sequelize.authenticate();
  await sequelize.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [applied] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = ?", { replacements: [NAME] });
  if (applied.length) return console.log(`${NAME} already applied`);

  await sequelize.transaction(async (transaction) => {
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'verification_challenges'", { transaction });
    if (!tables.length) throw new Error("verification_challenges does not exist; run the SMS authentication migration first.");
    await sequelize.query(
      "ALTER TABLE verification_challenges MODIFY purpose ENUM('registration_phone','phone_change','student_email','password_reset_email') NOT NULL",
      { transaction },
    );
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES (?)", { replacements: [NAME], transaction });
  });
  console.log(`${NAME} applied`);
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error("Password reset email OTP migration failed:", error.message);
  process.exit(1);
});
