const sequelize = require("../config/sequelize");

/**
 * Migration: Add youtube_video_id column to course_contents table
 * This stores the YouTube video ID for unlisted videos
 */
async function addYoutubeVideoIdColumn() {
  try {
    console.log("Adding youtube_video_id column to course_contents table...");

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'course_contents' 
      AND COLUMN_NAME = 'youtube_video_id';
    `);

    if (results.length > 0) {
      console.log("✓ Column youtube_video_id already exists, skipping...");
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE course_contents
      ADD COLUMN youtube_video_id VARCHAR(50)
      COMMENT 'YouTube video ID for unlisted videos';
    `);

    console.log("✓ Successfully added youtube_video_id column");
  } catch (error) {
    console.error("Failed to add youtube_video_id column:", error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  addYoutubeVideoIdColumn()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = addYoutubeVideoIdColumn;
