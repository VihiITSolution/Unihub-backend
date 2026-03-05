require("dotenv").config();

const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Run critical migrations to ensure tables have correct schema
const runCriticalMigrations = async (sequelizeInstance) => {
  try {
    // Step 1: Create notifications table if it doesn't exist (correct schema)
    await sequelizeInstance.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('tutor_approved','tutor_rejected','course_approved','course_rejected','enrollment','payment','general') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        link VARCHAR(500) NULL,
        metadata JSON NULL,
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

    // Step 2: Fix timestamp columns if they exist without default values
    try {
      await sequelizeInstance.query(`
        ALTER TABLE notifications
        MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
    } catch (alterError) {
      // Ignore - columns might already be correct
    }

    console.log("✓ Notifications table ready.");
  } catch (migrationError) {
    console.error("⚠ Notifications migration error:", migrationError.message);
  }
};

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();

    console.log("✓ Database connection has been established successfully.");

    // Sync models with database (creates tables if they don't exist)
    // In production, use migrations instead
    if (process.env.NODE_ENV !== "production") {
      try {
        await sequelize.sync({ alter: true });
        console.log("✓ Database models synchronized.");
      } catch (syncError) {
        console.error("⚠ Database synchronization failed:", syncError.message);
        console.log("Continuing server startup without synchronization...");
      }
    }

    // Run critical migrations (safe to run on every startup)
    await runCriticalMigrations(sequelize);

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`✓ API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("✗ Unable to start server:", error);
    process.exit(1);
  }
};

startServer();
