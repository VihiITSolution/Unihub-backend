const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function addVendorProfileTable() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Create vendor_profiles table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vendor_profiles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        shop_name VARCHAR(255) NOT NULL,
        shop_description TEXT,
        business_type ENUM('individual', 'business') DEFAULT 'individual',
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        tax_id VARCHAR(100) COMMENT 'Business tax identification number (optional)',
        is_approved BOOLEAN DEFAULT FALSE,
        approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        approved_by INT,
        is_active BOOLEAN DEFAULT TRUE,
        total_sales INT DEFAULT 0,
        total_revenue DECIMAL(12, 2) DEFAULT 0.00,
        average_rating DECIMAL(3, 2) DEFAULT 0.00,
        total_reviews INT DEFAULT 0,
        is_profile_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ vendor_profiles table created successfully');

    // Add is_vendor_profile_complete column to users table
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_vendor_profile_complete BOOLEAN DEFAULT FALSE
    `);

    console.log('✅ is_vendor_profile_complete column added to users table');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  addVendorProfileTable();
}

module.exports = addVendorProfileTable;
