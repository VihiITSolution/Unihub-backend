const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function updateMarketplaceStock() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Add stock and sold_count columns to marketplace_items table
    await sequelize.query(`
      ALTER TABLE marketplace_items 
      ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 0 COMMENT 'Available stock quantity',
      ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0 COMMENT 'Total units sold'
    `);

    console.log('✅ stock and sold_count columns added to marketplace_items table');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  updateMarketplaceStock();
}

module.exports = updateMarketplaceStock;
