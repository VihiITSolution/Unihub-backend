const sequelize = require("../config/sequelize");

async function migrate() {
  try {
    console.log("Creating chat tables...");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        participant_one_id INT NOT NULL,
        participant_two_id INT NOT NULL,
        context_type ENUM('general','course','marketplace_item','boarding_place','support') NOT NULL DEFAULT 'general',
        context_id INT NULL,
        last_message_at DATETIME NULL,
        last_message_preview VARCHAR(255) NULL,
        is_flagged TINYINT(1) DEFAULT 0,
        flagged_by INT NULL,
        flagged_at DATETIME NULL,
        flag_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_one_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (participant_two_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (flagged_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE INDEX idx_conversation_pair (participant_one_id, participant_two_id),
        INDEX idx_last_message_at (last_message_at),
        INDEX idx_participant_one (participant_one_id),
        INDEX idx_participant_two (participant_two_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created conversations table");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT NULL,
        message_type ENUM('text','attachment','system') NOT NULL DEFAULT 'text',
        is_read TINYINT(1) DEFAULT 0,
        read_at DATETIME NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_conversation_created (conversation_id, created_at),
        INDEX idx_sender_id (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created messages table");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id INT NOT NULL,
        url VARCHAR(500) NOT NULL,
        public_id VARCHAR(255) NULL,
        file_type ENUM('image','video','document') NOT NULL,
        original_filename VARCHAR(255) NULL,
        mime_type VARCHAR(100) NULL,
        file_size_bytes INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        INDEX idx_message_id (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created message_attachments table");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS blocked_message_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        attempted_body TEXT NOT NULL,
        matched_patterns JSON NOT NULL,
        reviewed_by_admin_id INT NULL,
        reviewed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created blocked_message_logs table");

    console.log("\n✅ Chat tables migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
