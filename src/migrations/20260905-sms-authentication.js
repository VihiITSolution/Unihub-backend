require("dotenv").config();
const { sequelize } = require("../models");

const NAME = "20260905-sms-authentication";

async function migrate() {
  await sequelize.authenticate();
  await sequelize.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [applied] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = ?", { replacements: [NAME] });
  if (applied.length) return console.log(`${NAME} already applied`);

  await sequelize.transaction(async (transaction) => {
    const query = (sql) => sequelize.query(sql, { transaction });
    try { await query("ALTER TABLE users ADD COLUMN verified_phone_number VARCHAR(16) NULL"); } catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    try { await query("ALTER TABLE users ADD COLUMN phone_verified_at DATETIME NULL"); } catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    try { await query("ALTER TABLE users ADD UNIQUE INDEX users_verified_phone_number_unique (verified_phone_number)"); } catch (error) { if (error.code !== "ER_DUP_KEYNAME") throw error; }
    try { await query("ALTER TABLE student_profiles ADD COLUMN student_email VARCHAR(255) NULL"); } catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    try { await query("ALTER TABLE student_profiles ADD COLUMN student_email_verified_at DATETIME NULL"); } catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    await query(`CREATE TABLE IF NOT EXISTS verification_challenges (
      id CHAR(36) PRIMARY KEY,
      purpose ENUM('registration_phone','phone_change','student_email') NOT NULL,
      destination VARCHAR(255) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      registration_payload JSON NULL,
      user_id INT NULL,
      expires_at DATETIME NOT NULL,
      last_sent_at DATETIME NOT NULL,
      send_count INT NOT NULL DEFAULT 1,
      attempt_count INT NOT NULL DEFAULT 0,
      consumed_at DATETIME NULL,
      ip_hash CHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX verification_challenges_destination_created (destination, created_at),
      INDEX verification_challenges_user_purpose (user_id, purpose),
      INDEX verification_challenges_expiry (expires_at),
      CONSTRAINT verification_challenges_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES (?)", { replacements: [NAME], transaction });
  });
  console.log(`${NAME} applied`);
}

migrate().then(() => process.exit(0)).catch((error) => { console.error("SMS authentication migration failed:", error.message); process.exit(1); });
