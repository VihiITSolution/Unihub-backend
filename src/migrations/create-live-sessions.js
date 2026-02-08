const sequelize = require('../config/sequelize');

async function migrate() {
  try {
    console.log('Creating live sessions tables...');
    
    // Create live_sessions table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tutor_id INT NOT NULL,
        course_id INT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scheduled_start_time DATETIME NOT NULL,
        scheduled_end_time DATETIME NOT NULL,
        actual_start_time DATETIME NULL,
        actual_end_time DATETIME NULL,
        is_free TINYINT(1) DEFAULT 1,
        price DECIMAL(10, 2) DEFAULT 0.00,
        platform_commission_rate DECIMAL(5, 2) DEFAULT 10.00 COMMENT 'Platform commission percentage',
        youtube_video_id VARCHAR(50) NULL COMMENT 'YouTube Live broadcast video ID',
        youtube_broadcast_id VARCHAR(100) NULL COMMENT 'YouTube Live broadcast ID',
        youtube_stream_key VARCHAR(255) NULL COMMENT 'Stream key for streaming software',
        stream_url VARCHAR(500) NULL COMMENT 'RTMP URL for streaming',
        max_attendees INT NULL COMMENT 'Maximum attendees (null = unlimited)',
        allow_recording TINYINT(1) DEFAULT 1,
        recording_url VARCHAR(500) NULL COMMENT 'YouTube URL of recorded session',
        status ENUM('scheduled', 'cancelled', 'live', 'ended', 'recorded') DEFAULT 'scheduled',
        enable_chat TINYINT(1) DEFAULT 1,
        chat_moderation ENUM('disabled', 'auto', 'manual') DEFAULT 'auto',
        thumbnail VARCHAR(500) NULL,
        tags JSON NULL,
        total_attendees INT DEFAULT 0,
        total_revenue DECIMAL(10, 2) DEFAULT 0.00,
        platform_commission DECIMAL(10, 2) DEFAULT 0.00,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        INDEX idx_tutor_id (tutor_id),
        INDEX idx_course_id (course_id),
        INDEX idx_status (status),
        INDEX idx_scheduled_start_time (scheduled_start_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created live_sessions table');

    // Create session_enrollments table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS session_enrollments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id INT NOT NULL,
        student_id INT NOT NULL,
        amount_paid DECIMAL(10, 2) DEFAULT 0.00,
        payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
        payment_id VARCHAR(100) NULL COMMENT 'Payment gateway transaction ID',
        joined_at DATETIME NULL,
        left_at DATETIME NULL,
        attendance_duration INT DEFAULT 0 COMMENT 'Total minutes attended',
        attended TINYINT(1) DEFAULT 0,
        invited_by INT NULL,
        invitation_status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
        reminder_sent TINYINT(1) DEFAULT 0,
        reminder_sent_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_session_enrollment (session_id, student_id),
        INDEX idx_session_id (session_id),
        INDEX idx_student_id (student_id),
        INDEX idx_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created session_enrollments table');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart the backend server');
    console.log('2. Create a live session via API: POST /api/live-sessions');
    console.log('3. Students can enroll: POST /api/live-sessions/:id/enroll');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
