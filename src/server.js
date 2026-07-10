require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { sequelize } = require("./models");
const { isOriginAllowed } = require("./config/cors");
const initSocket = require("./socket");

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
        type ENUM('tutor_approved','tutor_rejected','course_approved','course_rejected','enrollment','payment','general','follow','post_like','post_comment') NOT NULL,
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

    // Step 2b: Widen the type ENUM for tables created before the social
    // notification types (follow/post_like/post_comment, written by the
    // Unihub-social microservice) existed.
    try {
      await sequelizeInstance.query(`
        ALTER TABLE notifications
        MODIFY COLUMN type ENUM('tutor_approved','tutor_rejected','course_approved','course_rejected','enrollment','payment','general','follow','post_like','post_comment') NOT NULL
      `);
    } catch (alterError) {
      // Ignore - enum might already be widened
    }

    console.log("✓ Notifications table ready.");
  } catch (migrationError) {
    console.error("⚠ Notifications migration error:", migrationError.message);
  }

  try {
    // Step 3: Create chat tables if they don't exist (correct schema)
    await sequelizeInstance.query(`
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

    await sequelizeInstance.query(`
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

    await sequelizeInstance.query(`
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

    await sequelizeInstance.query(`
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

    console.log("✓ Chat tables ready.");
  } catch (migrationError) {
    console.error("⚠ Chat tables migration error:", migrationError.message);
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

    // Wrap Express in a plain HTTP server so Socket.io can attach to it -
    // Express alone can't handle the WebSocket upgrade handshake.
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) return callback(null, true);
          callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
      },
    });
    initSocket(io);
    app.set("io", io);

    httpServer.listen(PORT, () => {
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
