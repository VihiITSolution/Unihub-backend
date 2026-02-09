require('dotenv').config();
const sequelize = require('../config/sequelize');

async function fixUserRoles() {
  try {
    console.log('Fixing user roles...');

    // Simply update ALL users to have their primary role in the roles array
    const [result] = await sequelize.query(`
      UPDATE users 
      SET roles = JSON_ARRAY(primary_role)
    `);

    console.log(`✓ Updated ${result.affectedRows} users with proper roles array`);

    // Verify the update
    const [updatedUsers] = await sequelize.query(`
      SELECT id, email, primary_role, roles 
      FROM users 
      LIMIT 10
    `);

    console.log('\nUpdated users:');
    console.table(updatedUsers);

    console.log('\n✅ User roles fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing user roles:', error);
    process.exit(1);
  }
}

fixUserRoles();
