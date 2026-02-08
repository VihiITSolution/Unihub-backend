#!/usr/bin/env node

/**
 * Marketplace Module Migration Runner
 * Runs all marketplace-related database migrations in order
 */

const addVendorProfile = require('./add-vendor-profile');
const addMarketplaceStock = require('./add-marketplace-stock');
const createOrdersTable = require('./create-orders-table');

async function runMarketplaceMigrations() {
  console.log('🚀 Starting Marketplace Module Migrations...\n');

  try {
    // Step 1: Add vendor profile table
    console.log('Step 1/3: Adding vendor_profiles table...');
    await addVendorProfile();
    console.log('');

    // Step 2: Update marketplace_items table
    console.log('Step 2/3: Adding stock fields to marketplace_items...');
    await addMarketplaceStock();
    console.log('');

    // Step 3: Create orders table
    console.log('Step 3/3: Creating orders table...');
    await createOrdersTable();
    console.log('');

    console.log('✅ All marketplace migrations completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test vendor profile creation');
    console.log('   3. Create marketplace listings with stock');
    console.log('   4. Test order creation and management\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Ensure MySQL server is running');
    console.error('   - Check database connection settings in .env');
    console.error('   - Verify database exists');
    console.error('   - Check if tables already exist\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMarketplaceMigrations();
}

module.exports = runMarketplaceMigrations;
