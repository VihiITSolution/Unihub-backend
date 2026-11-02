// Queues course videos that could not be sent to YouTube because the project
// ran out of daily API quota, and records the state on the content row so a
// tutor sees "queued" rather than a silent failure.
require("dotenv").config();
const sequelize = require("../config/sequelize");

async function migrate() {
  await sequelize.authenticate();

  await sequelize.query(`CREATE TABLE IF NOT EXISTS video_upload_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    content_id INT NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    run_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX video_upload_jobs_status_run_after (status, run_after),
    INDEX video_upload_jobs_content (content_id),
    CONSTRAINT video_upload_jobs_content_fk FOREIGN KEY (content_id) REFERENCES course_contents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [columns] = await sequelize.query("SHOW COLUMNS FROM course_contents LIKE 'upload_status'");
  if (columns.length === 0) {
    await sequelize.query(
      "ALTER TABLE course_contents ADD COLUMN upload_status ENUM('ready','queued','failed') NOT NULL DEFAULT 'ready'",
    );
    console.log("Added course_contents.upload_status");
  }

  console.log("YouTube upload queue is ready");
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("YouTube upload queue migration failed:", error.message);
    process.exit(1);
  });
