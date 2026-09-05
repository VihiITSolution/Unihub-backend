require('dotenv').config();
const { sequelize } = require('../models');
const createAffiliateProgram = require('./create-affiliate-program');
const { seedEligibleAffiliateAccounts } = require('../services/affiliate.service');

const migrate = async () => {
  try {
    console.log('Starting database migration...');
    
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Sync all models (creates tables if they don't exist)
    await sequelize.sync({ force: false, alter: true });
    console.log('✓ All models synchronized successfully');
    await createAffiliateProgram(sequelize);
    await seedEligibleAffiliateAccounts();
    console.log('✓ Affiliate programme migrated and eligible referral links seeded');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
