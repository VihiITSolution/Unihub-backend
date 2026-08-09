const sequelize = require("../config/sequelize");

async function columnExists(tableName, columnName) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [tableName, columnName] },
  );
  return rows.length > 0;
}

async function createAdminOperations() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      category ENUM('technical','account','course','enrollment','payment','marketplace','feature','other') NOT NULL,
      priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      description TEXT NOT NULL,
      attachments JSON NULL,
      status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      assigned_to_admin_id INT NULL,
      admin_response TEXT NULL,
      responded_at DATETIME NULL,
      resolved_at DATETIME NULL,
      last_updated_by_admin_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_support_ticket_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_support_ticket_user (user_id),
      INDEX idx_support_ticket_status (status),
      INDEX idx_support_ticket_assignment (assigned_to_admin_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      actor_admin_id INT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(100) NULL,
      summary VARCHAR(500) NOT NULL,
      metadata JSON NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_admin_audit_actor FOREIGN KEY (actor_admin_id)
        REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_admin_audit_actor (actor_admin_id),
      INDEX idx_admin_audit_action (action),
      INDEX idx_admin_audit_target (target_type, target_id),
      INDEX idx_admin_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const supportColumns = [
    ["assigned_to_admin_id", "INT NULL"],
    ["admin_response", "TEXT NULL"],
    ["responded_at", "DATETIME NULL"],
    ["resolved_at", "DATETIME NULL"],
    ["last_updated_by_admin_id", "INT NULL"],
  ];

  for (const [name, definition] of supportColumns) {
    if (!(await columnExists("support_tickets", name))) {
      await sequelize.query(`ALTER TABLE support_tickets ADD COLUMN ${name} ${definition}`);
    }
  }
}

if (require.main === module) {
  createAdminOperations()
    .then(() => {
      console.log("Admin operations migration completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Admin operations migration failed:", error);
      process.exit(1);
    });
}

module.exports = createAdminOperations;
