require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'unihub_db'
    });

    console.log('Database connection established.');

    // Create universities table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS universities (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Official name of the university',
        short_name VARCHAR(100) COMMENT 'Abbreviated name or common name',
        city VARCHAR(100) NOT NULL COMMENT 'City where university is located',
        district VARCHAR(100) COMMENT 'District',
        province VARCHAR(100) COMMENT 'Province',
        address TEXT COMMENT 'Full address',
        latitude DECIMAL(10, 8) NOT NULL COMMENT 'Latitude coordinate',
        longitude DECIMAL(11, 8) NOT NULL COMMENT 'Longitude coordinate',
        website VARCHAR(255) COMMENT 'Official website URL',
        phone VARCHAR(20) COMMENT 'Contact phone number',
        email VARCHAR(100) COMMENT 'Contact email',
        type ENUM('public', 'private', 'international') DEFAULT 'public' COMMENT 'Type of university',
        is_active BOOLEAN DEFAULT true COMMENT 'Whether university is active in the system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_city (city),
        INDEX idx_location (latitude, longitude),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Universities table created successfully');

    // Insert seed data - Major Sri Lankan Universities
    await connection.execute(`
      INSERT IGNORE INTO universities (name, short_name, city, district, province, address, latitude, longitude, website, type) VALUES
      ('University of Colombo', 'UOC', 'Colombo', 'Colombo', 'Western', '94 Cumaratunga Munidasa Mawatha, Colombo 03', 6.9022, 79.8607, 'https://www.cmb.ac.lk', 'public'),
      ('University of Peradeniya', 'UOP', 'Peradeniya', 'Kandy', 'Central', 'Peradeniya', 7.2567, 80.5955, 'https://www.pdn.ac.lk', 'public'),
      ('University of Sri Jayewardenepura', 'USJ', 'Nugegoda', 'Colombo', 'Western', 'Gangodawila, Nugegoda', 6.8720, 79.8897, 'https://www.sjp.ac.lk', 'public'),
      ('University of Kelaniya', 'UOK', 'Kelaniya', 'Gampaha', 'Western', 'Kelaniya', 6.9553, 79.9202, 'https://www.kln.ac.lk', 'public'),
      ('University of Moratuwa', 'UOM', 'Moratuwa', 'Colombo', 'Western', 'Bandaranayake Mawatha, Moratuwa', 6.7963, 79.9000, 'https://www.mrt.ac.lk', 'public'),
      ('University of Ruhuna', 'UOR', 'Matara', 'Matara', 'Southern', 'Wellamadama, Matara', 5.9407, 80.5415, 'https://www.ruh.ac.lk', 'public'),
      ('University of Jaffna', 'UOJ', 'Jaffna', 'Jaffna', 'Northern', 'Thirunelvely, Jaffna', 9.6854, 80.0089, 'https://www.jfn.ac.lk', 'public'),
      ('Eastern University', 'EUSL', 'Batticaloa', 'Batticaloa', 'Eastern', 'Vantharumoolai, Chenkalady', 7.6870, 81.6897, 'https://www.esn.ac.lk', 'public'),
      ('South Eastern University', 'SEUSL', 'Oluvil', 'Ampara', 'Eastern', 'University Park, Oluvil', 7.1587, 81.8559, 'https://www.seu.ac.lk', 'public'),
      ('Rajarata University', 'RUSL', 'Mihintale', 'Anuradhapura', 'North Central', 'Mihintale', 8.3644, 80.5065, 'https://www.rjt.ac.lk', 'public'),
      ('Sabaragamuwa University', 'SUSL', 'Belihuloya', 'Ratnapura', 'Sabaragamuwa', 'P.O. Box 02, Belihuloya', 6.7169, 80.7645, 'https://www.sab.ac.lk', 'public'),
      ('Wayamba University', 'WUSL', 'Kuliyapitiya', 'Kurunegala', 'North Western', 'Makandura, Gonawila', 7.4860, 80.0312, 'https://www.wyb.ac.lk', 'public'),
      ('Uva Wellassa University', 'UWUSL', 'Badulla', 'Badulla', 'Uva', 'Passara Road, Badulla', 6.9809, 81.0583, 'https://www.uwu.ac.lk', 'public'),
      ('NSBM Green University', 'NSBM', 'Homagama', 'Colombo', 'Western', 'Pitipana, Homagama', 6.8449, 80.0039, 'https://www.nsbm.ac.lk', 'private'),
      ('SLIIT', 'SLIIT', 'Malabe', 'Colombo', 'Western', 'New Kandy Road, Malabe', 6.9147, 79.9730, 'https://www.sliit.lk', 'private'),
      ('IIT (Institute of Information Technology)', 'IIT', 'Colombo', 'Colombo', 'Western', '57, Ramakrishna Road, Colombo 06', 6.8926, 79.8600, 'https://www.iit.ac.lk', 'private'),
      ('Informatics Institute of Technology', 'IIT', 'Colombo', 'Colombo', 'Western', '57, Ramakrishna Road, Colombo 06', 6.8926, 79.8600, 'https://www.iit.ac.lk', 'private'),
      ('APIIT', 'APIIT', 'Colombo', 'Colombo', 'Western', '388, Union Place, Colombo 02', 6.9164, 79.8612, 'https://www.apiit.lk', 'private'),
      ('Aquinas College', 'Aquinas', 'Colombo', 'Colombo', 'Western', 'Kollupitiya, Colombo 03', 6.9080, 79.8500, 'https://www.aquinas.lk', 'private')
    `);

    console.log('✅ Seed data inserted successfully');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration
runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
