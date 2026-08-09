const sequelize = require("../config/sequelize");

async function createYouTubeRightsDeclarations() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS youtube_rights_declarations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NULL,
      signatory_name VARCHAR(255) NOT NULL,
      agreement_version VARCHAR(50) NOT NULL,
      agreement_text LONGTEXT NOT NULL,
      accepted_at DATETIME NOT NULL,
      accepted_ip VARCHAR(45) NULL,
      accepted_user_agent VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_youtube_rights_declaration_user (user_id),
      CONSTRAINT fk_youtube_rights_declaration_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [declarationColumns] = await sequelize.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'course_contents'
      AND COLUMN_NAME = 'youtube_rights_declaration_id'
  `);

  if (declarationColumns.length === 0) {
    await sequelize.query(`
      ALTER TABLE course_contents
      ADD COLUMN youtube_rights_declaration_id INT NULL,
      ADD COLUMN youtube_rights_confirmed_at DATETIME NULL,
      ADD INDEX idx_course_content_rights_declaration (youtube_rights_declaration_id),
      ADD CONSTRAINT fk_course_content_rights_declaration
        FOREIGN KEY (youtube_rights_declaration_id)
        REFERENCES youtube_rights_declarations(id) ON DELETE RESTRICT
    `);
  }
}

if (require.main === module) {
  createYouTubeRightsDeclarations()
    .then(() => {
      console.log("YouTube rights declaration migration completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("YouTube rights declaration migration failed:", error);
      process.exit(1);
    });
}

module.exports = createYouTubeRightsDeclarations;
