const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function createBoardingPlacesTable() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Create boarding_places table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS boarding_places (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        district VARCHAR(100),
        nearest_university VARCHAR(255),
        distance_to_university DECIMAL(5, 2) COMMENT 'Distance in kilometers',
        room_type ENUM('single', 'shared', 'apartment', 'annex') NOT NULL DEFAULT 'single',
        gender_preference ENUM('male', 'female', 'any') NOT NULL DEFAULT 'any',
        capacity INT NOT NULL DEFAULT 1 COMMENT 'Total number of students',
        available_slots INT NOT NULL COMMENT 'Currently available slots',
        monthly_rent DECIMAL(10, 2) NOT NULL,
        security_deposit DECIMAL(10, 2) DEFAULT 0,
        amenities JSON COMMENT 'Array of amenities',
        rules TEXT COMMENT 'House rules and regulations',
        images JSON COMMENT 'Array of image URLs',
        contact_phone VARCHAR(20) NOT NULL,
        contact_email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        is_paid BOOLEAN DEFAULT FALSE COMMENT 'Whether vendor paid for this listing',
        paid_at DATETIME,
        ad_fee DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Fee paid to UniHub',
        expires_at DATETIME COMMENT 'When the paid listing expires',
        view_count INT DEFAULT 0,
        inquiry_count INT DEFAULT 0,
        is_approved BOOLEAN DEFAULT FALSE,
        approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_vendor (vendor_id),
        INDEX idx_city (city),
        INDEX idx_room_type (room_type),
        INDEX idx_active (is_active),
        INDEX idx_paid (is_paid),
        INDEX idx_approval (approval_status)
      )
    `);

    console.log('✅ boarding_places table created successfully');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  createBoardingPlacesTable();
}

module.exports = createBoardingPlacesTable;
