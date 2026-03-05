/**
 * Drop and recreate notifications table with correct schema
 * Run: node recreate-notifications-table.js
 */

require("dotenv").config();
const sequelize = require("./src/config/sequelize");

async function recreateTable() {
  try {
    console.log("🔧 Dropping existing notifications table...");

    // Drop the table if it exists
    await sequelize.query("DROP TABLE IF EXISTS notifications");
    console.log("✓ Dropped notifications table");

    console.log("\n📝 Creating notifications table with correct schema...");

    // Create notifications table with proper defaults
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM(
          'tutor_approved',
          'tutor_rejected',
          'course_approved',
          'course_rejected',
          'enrollment',
          'payment',
          'general'
        ) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        link VARCHAR(500) NULL COMMENT 'Optional link to relevant page',
        metadata JSON NULL COMMENT 'Additional data related to notification',
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        INDEX idx_user_unread (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created notifications table with correct schema");

    console.log("\n✅ Table recreated successfully!");
    console.log("\nNext steps:");
    console.log("1. Run: node check-notification-setup.js");
    console.log("2. Restart the backend server");
    console.log("3. Test notifications!");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

recreateTable();
