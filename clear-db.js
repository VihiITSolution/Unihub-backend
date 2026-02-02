require('dotenv').config();
const { User, Course, MarketplaceItem, TutorProfile, StudentProfile, Enrollment, Payment, CourseContent, Order, LiveSession, SessionEnrollment, BoardingPlace } = require('./src/models');
const { sequelize } = require('./src/models');

async function clearDB() {
    try {
        console.log('Clearing database...');
        await sequelize.authenticate();

        // Disable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Truncate all tables
        const models = [
            SessionEnrollment,
            LiveSession,
            Order,
            Payment,
            Enrollment,
            CourseContent,
            MarketplaceItem,
            BoardingPlace,
            Course,
            TutorProfile,
            StudentProfile,
            VendorProfile,
            User
        ].filter(m => m !== undefined);

        for (const model of models) {
            if (model && model.tableName) {
                console.log(`Truncating ${model.tableName}...`);
                await model.destroy({ where: {}, truncate: true, cascade: true });
            }
        }

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Database cleared successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
}

// Need to make sure VendorProfile is imported too if it exists
const { VendorProfile } = require('./src/models');

clearDB();
