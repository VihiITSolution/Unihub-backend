/**
 * Migration: Add Course Approval Fields
 * 
 * Run this migration to add approval workflow columns to the courses table
 * Execute: node src/migrations/add-course-approval.js
 */

require('dotenv').config();
const sequelize = require('../config/sequelize');

const migrate = async () => {
  try {
    console.log('Starting migration: Add Course Approval Fields...\n');

    // Add approval_status column
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN approval_status ENUM('draft', 'pending', 'approved', 'rejected') 
        DEFAULT 'draft' 
        AFTER review_count
      `);
      console.log('✓ Added approval_status column');
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log('- approval_status column already exists');
      } else {
        throw e;
      }
    }

    // Add approved_by column
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN approved_by INT 
        REFERENCES users(id) 
        AFTER approval_status
      `);
      console.log('✓ Added approved_by column');
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log('- approved_by column already exists');
      } else {
        throw e;
      }
    }

    // Add approved_at column
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN approved_at DATETIME 
        AFTER approved_by
      `);
      console.log('✓ Added approved_at column');
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log('- approved_at column already exists');
      } else {
        throw e;
      }
    }

    // Add rejection_reason column
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN rejection_reason TEXT 
        AFTER approved_at
      `);
      console.log('✓ Added rejection_reason column');
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log('- rejection_reason column already exists');
      } else {
        throw e;
      }
    }

    // Add submitted_for_review_at column
    try {
      await sequelize.query(`
        ALTER TABLE courses 
        ADD COLUMN submitted_for_review_at DATETIME 
        AFTER rejection_reason
      `);
      console.log('✓ Added submitted_for_review_at column');
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log('- submitted_for_review_at column already exists');
      } else {
        throw e;
      }
    }

    // Update existing courses to have 'approved' status if they are published
    await sequelize.query(`
      UPDATE courses 
      SET approval_status = 'approved' 
      WHERE is_published = true AND approval_status = 'draft'
    `);
    console.log('✓ Updated existing published courses to approved status');

    console.log('\n=================================');
    console.log('Migration completed successfully!');
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
