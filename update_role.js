const { User, sequelize } = require('./src/models');
const bcrypt = require('bcryptjs');

async function update() {
  try {
    await sequelize.authenticate();
    console.log('Connection established.');
    
    const email = 'testuser_multi@example.com';
    let user = await User.findOne({ where: { email } });
    
    if (user) {
      console.log('User found:', user.email);
      user.roles = ['student', 'tutor', 'vendor'];
      user.primaryRole = 'student';
      await user.save();
      console.log('User updated with roles:', user.roles);
    } else {
      console.log('User not found. Creating user...');
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      user = await User.create({
        fullName: 'Multi Role User',
        email: email,
        password: hashedPassword,
        roles: ['student', 'tutor', 'vendor'],
        primaryRole: 'student',
        isActive: true
      });
      console.log('User created with roles:', user.roles);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Give it a moment to ensure write completes if async issues exist in logging
    setTimeout(async () => {
      await sequelize.close();
      process.exit();
    }, 1000);
  }
}

update();
