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
    const hasColumn = async (table, column) => {
      const [rows] = await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE ?`, { replacements: [column], transaction });
      return rows.length > 0;
    };
    const hasIndex = async (table, index) => {
      const [rows] = await sequelize.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, { replacements: [index], transaction });
      return rows.length > 0;
    };
    if (!(await hasColumn("users", "verified_phone_number"))) await query("ALTER TABLE users ADD COLUMN verified_phone_number VARCHAR(16) NULL");
    if (!(await hasColumn("users", "phone_verified_at"))) await query("ALTER TABLE users ADD COLUMN phone_verified_at DATETIME NULL");
    if (!(await hasIndex("users", "users_verified_phone_number_unique"))) {
      try {
        await query("ALTER TABLE users ADD UNIQUE INDEX users_verified_phone_number_unique (verified_phone_number)");
      } catch (error) {
        // This legacy users table may already be at MySQL's 64-index limit.
        // The service still rejects duplicate verified numbers; do not delete
        // an unrelated index during an authentication rollout.
        if (error.code !== "ER_TOO_MANY_KEYS" && !/too many keys specified/i.test(error.message || "")) throw error;
        console.warn("Could not add verified-phone unique index: users table is at MySQL's index limit.");
      }
    }
    if (!(await hasColumn("student_profiles", "student_email"))) await query("ALTER TABLE student_profiles ADD COLUMN student_email VARCHAR(255) NULL");
    if (!(await hasColumn("student_profiles", "student_email_verified_at"))) await query("ALTER TABLE student_profiles ADD COLUMN student_email_verified_at DATETIME NULL");
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
