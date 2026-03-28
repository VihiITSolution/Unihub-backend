const sequelize = require("../config/sequelize");

/**
 * Migration: Add completed_contents column to enrollments table
 * This tracks which specific course content items have been completed by each student
 */
async function addCompletedContentsColumn() {
  try {
    console.log("Adding completed_contents column to enrollments table...");

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'enrollments' 
      AND COLUMN_NAME = 'completed_contents';
    `);

    if (results.length > 0) {
      console.log("✓ Column completed_contents already exists, skipping...");
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE enrollments
      ADD COLUMN completed_contents JSON DEFAULT '[]'
      COMMENT 'Array of completed course content IDs';
    `);

    console.log("✓ Successfully added completed_contents column");
  } catch (error) {
    console.error("Failed to add completed_contents column:", error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  addCompletedContentsColumn()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = addCompletedContentsColumn;
