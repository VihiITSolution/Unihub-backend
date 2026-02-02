require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();

    console.log('✓ Database connection has been established successfully.');

    // Sync models with database (creates tables if they don't exist)
    // In production, use migrations instead
    if (process.env.NODE_ENV !== 'production') {
      try {
        await sequelize.sync({ alter: true });
        console.log('✓ Database models synchronized.');
      } catch (syncError) {
        console.error('⚠ Database synchronization failed:', syncError.message);
        console.log('Continuing server startup without synchronization...');
      }
    }


    // Start server
    app.listen(PORT, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
