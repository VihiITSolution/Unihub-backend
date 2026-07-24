const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function addBoardingVideosField() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const [rows] = await sequelize.query(`
      SHOW COLUMNS FROM boarding_places LIKE 'videos'
    `);

    if (rows.length === 0) {
      await sequelize.query(`
        ALTER TABLE boarding_places
        ADD COLUMN videos JSON DEFAULT NULL
          COMMENT 'Array of video URLs'
      `);
      console.log('✅ videos column added to boarding_places table');
    } else {
      console.log('ℹ️  videos column already exists');
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
  addBoardingVideosField();
}

module.exports = addBoardingVideosField;
