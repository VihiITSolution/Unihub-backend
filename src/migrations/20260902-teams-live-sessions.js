require("dotenv").config();
const sequelize = require("../config/sequelize");

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    { replacements: [table, column] },
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function migrateTeamsLiveSessions() {
  await sequelize.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [applied] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = ?", { replacements: ["20260902-teams-live-sessions"] });
  if (applied.length) {
    console.log("Teams live-session migration already applied.");
    return;
  }

  await addColumn("live_sessions", "provider", "ENUM('youtube','teams') NOT NULL DEFAULT 'youtube'");
  await addColumn("live_sessions", "approval_status", "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  await addColumn("live_sessions", "provider_status", "ENUM('not_provisioned','provisioning','ready','syncing','failed','cancelled') NOT NULL DEFAULT 'ready'");
  await addColumn("live_sessions", "rejection_reason", "TEXT NULL");
  await addColumn("live_sessions", "approved_by", "INT NULL");
  await addColumn("live_sessions", "approved_at", "DATETIME NULL");
  await addColumn("live_sessions", "provider_synced_at", "DATETIME NULL");

  // Existing records are intentionally preserved as YouTube sessions.
  await sequelize.query("UPDATE live_sessions SET provider='youtube', approval_status='approved', provider_status='ready'");
  await sequelize.query("ALTER TABLE live_sessions MODIFY provider ENUM('youtube','teams') NOT NULL DEFAULT 'teams'");
  await sequelize.query("ALTER TABLE live_sessions MODIFY approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
  await sequelize.query("ALTER TABLE live_sessions MODIFY provider_status ENUM('not_provisioned','provisioning','ready','syncing','failed','cancelled') NOT NULL DEFAULT 'not_provisioned'");

  await addColumn("session_enrollments", "join_launched_at", "DATETIME NULL");
  await addColumn("session_enrollments", "provider_attendee_id", "VARCHAR(255) NULL");
  await addColumn("session_enrollments", "attendance_intervals", "JSON NULL");
  await addColumn("session_enrollments", "attendance_source", "ENUM('unihub','teams') NOT NULL DEFAULT 'unihub'");
  await addColumn("session_enrollments", "attendance_sync_status", "ENUM('pending','synced','unmatched','failed') NOT NULL DEFAULT 'pending'");
  await addColumn("tutor_profiles", "teams_email", "VARCHAR(255) NULL");

  await sequelize.query(`CREATE TABLE IF NOT EXISTS meeting_organizer_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider ENUM('teams') NOT NULL DEFAULT 'teams',
    email VARCHAR(255) NOT NULL UNIQUE,
    entra_user_id VARCHAR(255) NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    health_status ENUM('unknown','healthy','unhealthy') NOT NULL DEFAULT 'unknown',
    last_health_check_at DATETIME NULL,
    health_message VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await sequelize.query(`CREATE TABLE IF NOT EXISTS live_session_meetings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL UNIQUE,
    organizer_account_id INT NOT NULL,
    provider ENUM('teams') NOT NULL DEFAULT 'teams',
    outlook_event_id VARCHAR(512) NULL UNIQUE,
    teams_meeting_id VARCHAR(512) NULL,
    join_url TEXT NULL,
    meeting_options_url TEXT NULL,
    recording_id VARCHAR(512) NULL,
    recording_drive_item_id VARCHAR(512) NULL,
    recording_web_url TEXT NULL,
    sync_status ENUM('pending','syncing','ready','failed','cancelled') NOT NULL DEFAULT 'pending',
    last_error VARCHAR(500) NULL,
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_account_id) REFERENCES meeting_organizer_accounts(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await sequelize.query(`CREATE TABLE IF NOT EXISTS user_meeting_identities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    provider ENUM('teams') NOT NULL DEFAULT 'teams',
    email VARCHAR(255) NOT NULL,
    entra_guest_id VARCHAR(255) NULL,
    invitation_redeem_url TEXT NULL,
    invitation_status ENUM('not_invited','pending','accepted','failed') NOT NULL DEFAULT 'not_invited',
    last_error VARCHAR(500) NULL,
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_meeting_provider (user_id, provider),
    INDEX idx_meeting_identity_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await sequelize.query(`CREATE TABLE IF NOT EXISTS live_session_provider_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    type ENUM('provision','attendee_sync','artifact_sync','cancel','recording_delete') NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    run_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    payload JSON NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    INDEX idx_provider_jobs_ready (status, run_after)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await sequelize.query(`CREATE TABLE IF NOT EXISTS live_session_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    actor_user_id INT NULL,
    type VARCHAR(100) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_session_event_timeline (session_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  if (process.env.TEAMS_ORGANIZER_EMAIL) {
    await sequelize.query(
      "INSERT INTO meeting_organizer_accounts (email, entra_user_id, enabled) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE entra_user_id=VALUES(entra_user_id), enabled=1",
      { replacements: [process.env.TEAMS_ORGANIZER_EMAIL.toLowerCase(), process.env.TEAMS_ORGANIZER_USER_ID || null] },
    );
  }
  await sequelize.query("INSERT INTO schema_migrations (name) VALUES (?)", { replacements: ["20260902-teams-live-sessions"] });
}

if (require.main === module) {
  migrateTeamsLiveSessions()
    .then(() => { console.log("Teams live-session migration completed."); process.exit(0); })
    .catch((error) => { console.error("Teams live-session migration failed:", error); process.exit(1); });
}

module.exports = migrateTeamsLiveSessions;
