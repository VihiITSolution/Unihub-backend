const sequelize = require('../config/sequelize');

async function migrate() {
  try {
    console.log('Updating users table schema for multi-role support...');
    
    // Check if roles column already exists
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'roles'
    `);
    
    if (columns.length === 0) {
      // First, convert role column to VARCHAR to allow any value temporarily
      await sequelize.query(`
        ALTER TABLE users 
        MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'
      `);
      console.log('✓ Converted role to VARCHAR temporarily');
      
      // Update 'learner' to 'student' in existing data
      await sequelize.query(`
        UPDATE users 
        SET role = 'student' 
        WHERE role = 'learner'
      `);
      console.log('✓ Updated learner role to student');
      
      // Now rename and convert to the new ENUM
      await sequelize.query(`
        ALTER TABLE users 
        CHANGE COLUMN role primary_role ENUM('student', 'tutor', 'vendor', 'admin') 
        NOT NULL DEFAULT 'student'
      `);
      console.log('✓ Renamed role to primary_role and updated enum values');
      
      // Add new roles column as JSON
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN roles JSON 
        NOT NULL 
        COMMENT 'Array of roles: student, tutor, admin'
        AFTER password
      `);
      console.log('✓ Added roles column');
      
      // Migrate existing data: convert primary_role to roles array
      await sequelize.query(`
        UPDATE users 
        SET roles = JSON_ARRAY(primary_role)
        WHERE roles IS NULL OR JSON_LENGTH(roles) = 0
      `);
      console.log('✓ Migrated existing role data to roles array');
      
      // Add profile completion columns
      const [profileColumns] = await sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME IN ('is_student_profile_complete', 'is_tutor_profile_complete')
      `);
      
      if (profileColumns.length === 0) {
        await sequelize.query(`
          ALTER TABLE users 
          ADD COLUMN is_student_profile_complete TINYINT(1) DEFAULT 0,
          ADD COLUMN is_tutor_profile_complete TINYINT(1) DEFAULT 0
        `);
        console.log('✓ Added profile completion columns');
      }
    } else {
      console.log('ℹ Roles column already exists, skipping migration');
    }
    
    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
