const sequelize = require("../config/sequelize");

async function migrate() {
  try {
    console.log("Creating notifications table...");

    // Create notifications table
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
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        INDEX idx_user_unread (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created notifications table");

    console.log("\n✅ Migration completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Restart the backend server");
    console.log("2. Test notifications API: GET /api/notifications");
    console.log("3. Check unread count: GET /api/notifications/unread-count");
    console.log(
      "4. Notifications will be created automatically when admin approves/rejects tutor applications",
    );

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
