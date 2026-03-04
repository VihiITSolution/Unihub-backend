const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.development);

async function addMarketplacePaymentFields() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check and add is_paid column
    const [isPaidColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'is_paid'
    `);
    
    if (isPaidColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN is_paid BOOLEAN DEFAULT FALSE COMMENT 'Whether the ad fee has been paid'
      `);
      console.log('✅ is_paid column added to marketplace_items table');
    } else {
      console.log('ℹ️  is_paid column already exists');
    }

    // Check and add ad_fee column
    const [adFeeColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'ad_fee'
    `);
    
    if (adFeeColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN ad_fee DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Calculated ad posting fee'
      `);
      console.log('✅ ad_fee column added to marketplace_items table');
    } else {
      console.log('ℹ️  ad_fee column already exists');
    }

    // Check and add paid_at column
    const [paidAtColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'paid_at'
    `);
    
    if (paidAtColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN paid_at DATETIME NULL COMMENT 'Timestamp when payment was completed'
      `);
      console.log('✅ paid_at column added to marketplace_items table');
    } else {
      console.log('ℹ️  paid_at column already exists');
    }

    // Check and add payment_id column
    const [paymentIdColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'payment_id'
    `);
    
    if (paymentIdColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN payment_id INT NULL COMMENT 'Reference to payment record',
        ADD FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
      `);
      console.log('✅ payment_id column added to marketplace_items table');
    } else {
      console.log('ℹ️  payment_id column already exists');
    }

    // Check and add approval_status column
    const [approvalStatusColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'approval_status'
    `);
    
    if (approvalStatusColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Admin approval status'
      `);
      console.log('✅ approval_status column added to marketplace_items table');
    } else {
      console.log('ℹ️  approval_status column already exists');
    }

    // Check and add approved_by column
    const [approvedByColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'approved_by'
    `);
    
    if (approvedByColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN approved_by INT NULL COMMENT 'Admin who approved/rejected the listing',
        ADD FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✅ approved_by column added to marketplace_items table');
    } else {
      console.log('ℹ️  approved_by column already exists');
    }

    // Check and add approved_at column
    const [approvedAtColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'approved_at'
    `);
    
    if (approvedAtColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN approved_at DATETIME NULL COMMENT 'Timestamp of approval/rejection'
      `);
      console.log('✅ approved_at column added to marketplace_items table');
    } else {
      console.log('ℹ️  approved_at column already exists');
    }

    // Check and add rejection_reason column
    const [rejectionReasonColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'rejection_reason'
    `);
    
    if (rejectionReasonColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN rejection_reason TEXT NULL COMMENT 'Reason for rejection if applicable'
      `);
      console.log('✅ rejection_reason column added to marketplace_items table');
    } else {
      console.log('ℹ️  rejection_reason column already exists');
    }

    // Check and add expires_at column
    const [expiresAtColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'expires_at'
    `);
    
    if (expiresAtColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN expires_at DATETIME NULL COMMENT 'Ad expiration timestamp'
      `);
      console.log('✅ expires_at column added to marketplace_items table');
    } else {
      console.log('ℹ️  expires_at column already exists');
    }

    // Check and add requires_payment column
    const [requiresPaymentColumn] = await sequelize.query(`
      SHOW COLUMNS FROM marketplace_items LIKE 'requires_payment'
    `);
    
    if (requiresPaymentColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE marketplace_items 
        ADD COLUMN requires_payment BOOLEAN DEFAULT TRUE COMMENT 'Whether this category requires payment'
      `);
      console.log('✅ requires_payment column added to marketplace_items table');
    } else {
      console.log('ℹ️  requires_payment column already exists');
    }

    // Update existing listings to be approved and paid for backward compatibility
    await sequelize.query(`
      UPDATE marketplace_items 
      SET is_paid = TRUE, 
          approval_status = 'approved',
          requires_payment = FALSE
      WHERE is_paid IS NULL OR is_paid = FALSE
    `);
    console.log('✅ Existing listings marked as paid and approved for backward compatibility');

    await sequelize.close();
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  addMarketplacePaymentFields();
}

module.exports = addMarketplacePaymentFields;
