require("dotenv").config();
const { sequelize } = require("../models");

const NAME = "20260905-grandfather-existing-phone-verification";

async function migrate() {
  await sequelize.authenticate();
  await sequelize.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [applied] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = ?", { replacements: [NAME] });
  if (applied.length) return console.log(`${NAME} already applied`);

  await sequelize.transaction(async (transaction) => {
    // Existing active accounts predate mandatory OTP registration. Preserve
    // their access by grandfathering their mobile-verification status; no
    // legacy phone value is copied into verified_phone_number unless it is
    // verified through the new Sri Lankan OTP flow.
    const [, metadata] = await sequelize.query(
      "UPDATE users SET phone_verified_at = NOW() WHERE is_active = 1 AND phone_verified_at IS NULL",
      { transaction },
    );
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES (?)", { replacements: [NAME], transaction });
    console.log(`Grandfathered ${metadata.affectedRows || 0} existing active account(s) as mobile verified.`);
  });
}

migrate().then(() => process.exit(0)).catch((error) => { console.error("Existing-account verification backfill failed:", error.message); process.exit(1); });
