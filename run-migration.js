/**
 * Migration Runner Script
 * Executes the faculty migration
 */

const sequelize = require("./src/config/sequelize");
const migration = require("./src/migrations/add-faculty-and-year-to-courses");

async function runMigration() {
  try {
    console.log("Starting migration...");
    console.log("Connecting to database...");

    // Test connection
    await sequelize.authenticate();
    console.log("✓ Database connection established");

    // Run the migration
    console.log("\nRunning migration: add-faculty-and-year-to-courses");
    await migration.up(sequelize.getQueryInterface(), sequelize.constructor);

    console.log("\n✅ Migration completed successfully!");

    // Close connection
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  }
}

runMigration();
