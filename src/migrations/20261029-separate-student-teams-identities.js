require("dotenv").config();
const sequelize = require("../config/sequelize");

async function separateStudentTeamsIdentities() {
  const [columns] = await sequelize.query("SHOW COLUMNS FROM user_meeting_identities");
  if (!columns.some((column) => column.Field === "identity_type")) {
    await sequelize.query("ALTER TABLE user_meeting_identities ADD COLUMN identity_type ENUM('student','tutor') NOT NULL DEFAULT 'student' AFTER provider");
  }

  // Existing identities that match a tutor's configured Teams email (or are
  // used by a hosted Teams session) remain tutor identities after the split.
  await sequelize.query(`
    UPDATE user_meeting_identities identity_row
    LEFT JOIN tutor_profiles profile ON profile.user_id = identity_row.user_id
    LEFT JOIN live_sessions session_row ON session_row.tutor_id = identity_row.user_id AND session_row.provider = 'teams'
    SET identity_row.identity_type = 'tutor'
    WHERE identity_row.provider = 'teams'
      AND (BINARY LOWER(COALESCE(profile.teams_email, '')) = BINARY LOWER(identity_row.email) OR session_row.id IS NOT NULL)
  `);

  const [indexes] = await sequelize.query("SHOW INDEX FROM user_meeting_identities");
  // The legacy unique key can be the only index supporting the user foreign
  // key. Add a dedicated one before replacing that unique constraint.
  if (!indexes.some((index) => index.Key_name === "idx_meeting_identity_user")) {
    await sequelize.query("ALTER TABLE user_meeting_identities ADD INDEX idx_meeting_identity_user (user_id)");
  }
  const legacyUniqueIndexes = [...new Set(indexes
    .filter((index) => Number(index.Non_unique) === 0 && ["uq_user_meeting_provider", "user_meeting_identities_user_id_provider"].includes(index.Key_name))
    .map((index) => index.Key_name))];
  for (const indexName of legacyUniqueIndexes) {
    await sequelize.query(`ALTER TABLE user_meeting_identities DROP INDEX \`${indexName}\``);
  }
  const hasScopedIndex = indexes.some((index) => index.Key_name === "uq_user_meeting_provider_type");
  if (!hasScopedIndex) {
    await sequelize.query("ALTER TABLE user_meeting_identities ADD UNIQUE KEY uq_user_meeting_provider_type (user_id, provider, identity_type)");
  }
}

if (require.main === module) {
  separateStudentTeamsIdentities()
    .then(() => { console.log("Student and tutor Teams identities separated"); process.exit(0); })
    .catch((error) => { console.error(error); process.exit(1); });
}

module.exports = separateStudentTeamsIdentities;
