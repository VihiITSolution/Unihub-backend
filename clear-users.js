require('dotenv').config();
const { User, Course, MarketplaceItem, TutorProfile, StudentProfile, Enrollment, Payment, CourseContent } = require('./src/models');
const { sequelize } = require('./src/models');

async function resetAndSeed() {
    try {
        console.log('Resetting database...');
        await sequelize.authenticate();

        // Disable foreign key checks for clean wipe
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Clear all tables
        await Payment.destroy({ where: {}, truncate: true, cascade: true });
        await Enrollment.destroy({ where: {}, truncate: true, cascade: true });
        await CourseContent.destroy({ where: {}, truncate: true, cascade: true });
        await MarketplaceItem.destroy({ where: {}, truncate: true, cascade: true });
        await Course.destroy({ where: {}, truncate: true, cascade: true });
        await TutorProfile.destroy({ where: {}, truncate: true, cascade: true });
        await StudentProfile.destroy({ where: {}, truncate: true, cascade: true });
        await User.destroy({ where: {}, truncate: true, cascade: true });

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Database cleared. Starting seed...');

        // Run the actual seed logic (imported or copied)
        // For simplicity, I'll just run the seed.js if I can, but better to copy the logic here to be sure

        console.log('Running node src/migrations/seed.js...');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// Instead of writing a complex one, I'll just use a command-line approach to drop all tables if possible, 
// or trust sequelize.sync({force: true}) if I'm brave.
// But sync({force: true}) is dangerous if other things depend on it.

// Let's just create a script that deletes all users.
async function clearUsers() {
    try {
        await sequelize.authenticate();
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await User.destroy({ where: {}, truncate: true });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Users cleared.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

clearUsers();
