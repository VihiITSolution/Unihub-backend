const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function createOrdersTable() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Create orders table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'Human-readable order ID (e.g., ORD-UUID)',
        buyer_id INT NOT NULL,
        seller_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL COMMENT 'Price per unit at time of purchase',
        total_price DECIMAL(12, 2) NOT NULL COMMENT 'Total order amount (quantity * unitPrice)',
        status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending' NOT NULL,
        shipping_address TEXT,
        buyer_notes TEXT COMMENT 'Special instructions from buyer',
        seller_notes TEXT COMMENT 'Internal notes from seller',
        tracking_number VARCHAR(100),
        payment_id INT,
        confirmed_at TIMESTAMP NULL,
        shipped_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,
        cancellation_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        INDEX idx_buyer (buyer_id),
        INDEX idx_seller (seller_id),
        INDEX idx_item (item_id),
        INDEX idx_status (status)
      )
    `);

    console.log('✅ orders table created successfully');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  createOrdersTable();
}

module.exports = createOrdersTable;
