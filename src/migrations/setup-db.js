require('dotenv').config();
const mysql = require('mysql2/promise');

const setupDatabase = async () => {
  try {
    console.log('Setting up database...');

    // Connect to MySQL without specifying database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    console.log('✓ Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✓ Database '${process.env.DB_NAME}' created/verified`);

    await connection.end();
    console.log('✓ Database setup completed successfully!');
    console.log('\nNow run: npm run migrate');
    
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exit(1);
  }
};

setupDatabase();
