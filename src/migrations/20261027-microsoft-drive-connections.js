require("dotenv").config();
const sequelize = require("../config/sequelize");

async function migrate() {
  await sequelize.authenticate();
  await sequelize.query(`CREATE TABLE IF NOT EXISTS microsoft_drive_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    microsoft_user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    display_name VARCHAR(255) NULL,
    encrypted_refresh_token LONGTEXT NOT NULL,
    connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT microsoft_drive_connections_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("Microsoft Drive connections table is ready");
}

migrate().then(() => process.exit(0)).catch((error) => { console.error("Microsoft Drive migration failed:", error.message); process.exit(1); });
