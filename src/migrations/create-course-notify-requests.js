const sequelize = require("../config/sequelize");

async function createCourseNotifyRequests() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS course_notify_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      course_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_course_notify_request_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_course_notify_request_course
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE INDEX uq_course_notify_request_user_course (user_id, course_id),
      INDEX idx_course_notify_request_course (course_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

if (require.main === module) {
  createCourseNotifyRequests()
    .then(() => {
      console.log("Course notification requests migration completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Course notification requests migration failed:", error);
      process.exit(1);
    });
}

module.exports = createCourseNotifyRequests;
