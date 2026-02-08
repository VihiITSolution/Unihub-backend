const { User } = require('./src/models');
const { sequelize } = require('./src/models');

async function checkUsers() {
    try {
        console.log(`DB Host: ${sequelize.options.host}`);
        console.log(`DB Name: ${sequelize.config.database}`);

        await sequelize.authenticate();
        console.log('Connection authenticated.');

        const users = await User.findAll({ raw: true });
        console.log(`Total users found: ${users.length}`);
        users.forEach(u => {
            console.log(`- ID: ${u.id}, Email: ${u.email}, Name: ${u.firstName} ${u.lastName}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error checking users:');
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
