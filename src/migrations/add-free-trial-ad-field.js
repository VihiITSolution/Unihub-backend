const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function addFreeTrialAdField() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const [rows] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'is_free_trial_ad'
    `);

    if (rows.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items
        ADD COLUMN is_free_trial_ad BOOLEAN DEFAULT FALSE
          COMMENT 'Posted during the limited-time free trial promotion'
      `);
      console.log('✅ is_free_trial_ad column added to marketplace_items table');
    } else {
      console.log('ℹ️  is_free_trial_ad column already exists');
    }

    await sequelize.close();
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

if (require.main === module) {
  addFreeTrialAdField();
}

module.exports = addFreeTrialAdField;
