const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function updateMarketplaceStock() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check if stock column exists
    const [stockColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'stock'
    `);
    
    if (stockColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN stock INT NOT NULL DEFAULT 0 COMMENT 'Available stock quantity'
      `);
      console.log('✅ stock column added to marketplace_items table');
    } else {
      console.log('ℹ️  stock column already exists');
    }

    // Check if sold_count column exists
    const [soldColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'sold_count'
    `);
    
    if (soldColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN sold_count INT DEFAULT 0 COMMENT 'Total units sold'
      `);
      console.log('✅ sold_count column added to marketplace_items table');
    } else {
      console.log('ℹ️  sold_count column already exists');
    }

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
