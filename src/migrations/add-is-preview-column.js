const sequelize = require("../config/sequelize");

/**
 * Migration: Add is_preview column to course_contents table
 * This tracks which materials can be previewed by non-enrolled students
 */
async function addIsPreviewColumn() {
  try {
    console.log("Adding is_preview column to course_contents table...");

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'course_contents' 
      AND COLUMN_NAME = 'is_preview';
    `);

    if (results.length > 0) {
      console.log("✓ Column is_preview already exists, skipping...");
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE course_contents
      ADD COLUMN is_preview BOOLEAN DEFAULT FALSE
      COMMENT 'Whether this material can be previewed by non-enrolled students';
    `);

    console.log("✓ Successfully added is_preview column");
  } catch (error) {
    console.error("Failed to add is_preview column:", error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  addIsPreviewColumn()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { addIsPreviewColumn };
