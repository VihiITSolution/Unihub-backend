const { User } = require('./src/models');
const { sequelize } = require('./src/models');
const bcrypt = require('bcryptjs');

async function testPassword() {
    try {
        const email = 'admin@unihub.com';
        const password = 'admin123';
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log('NOT_FOUND');
        } else {
            const isValid = await user.validatePassword(password);
            console.log(`RESULT:${isValid}:ID:${user.id}:HASH:${user.password}`);
        }
        process.exit(0);
    } catch (err) {
        console.log(`ERROR:${err.message}`);
        process.exit(1);
    }
}

testPassword();
