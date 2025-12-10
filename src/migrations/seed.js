require('dotenv').config();
const { User, Course, MarketplaceItem } = require('../models');

const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@unihub.com',
      password: 'admin123',
      role: 'admin',
      isVerified: true,
      isActive: true
    });
    console.log('✓ Admin user created');

    // Create tutor users
    const tutor1 = await User.create({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@unihub.com',
      password: 'tutor123',
      role: 'tutor',
      bio: 'Experienced software developer and instructor',
      isVerified: true,
      isActive: true
    });

    const tutor2 = await User.create({
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@unihub.com',
      password: 'tutor123',
      role: 'tutor',
      bio: 'Mathematics expert with 10+ years of teaching experience',
      isVerified: true,
      isActive: true
    });
    console.log('✓ Tutor users created');

    // Create learner users
    const learner1 = await User.create({
      firstName: 'Mike',
      lastName: 'Davis',
      email: 'mike.davis@unihub.com',
      password: 'learner123',
      role: 'learner',
      isVerified: true,
      isActive: true
    });

    const learner2 = await User.create({
      firstName: 'Emily',
      lastName: 'Brown',
      email: 'emily.brown@unihub.com',
      password: 'learner123',
      role: 'learner',
      isVerified: true,
      isActive: true
    });
    console.log('✓ Learner users created');

    // Create sample courses
    const course1 = await Course.create({
      tutorId: tutor1.id,
      title: 'Introduction to Web Development',
      description: 'Learn the basics of HTML, CSS, and JavaScript to build modern websites',
      category: 'Programming',
      level: 'beginner',
      price: 49.99,
      duration: 40,
      isPublished: true
    });

    const course2 = await Course.create({
      tutorId: tutor1.id,
      title: 'Advanced JavaScript and React',
      description: 'Master modern JavaScript and React framework for building dynamic web applications',
      category: 'Programming',
      level: 'advanced',
      price: 99.99,
      duration: 60,
      isPublished: true
    });

    const course3 = await Course.create({
      tutorId: tutor2.id,
      title: 'Calculus I - Complete Course',
      description: 'Comprehensive calculus course covering limits, derivatives, and integrals',
      category: 'Mathematics',
      level: 'intermediate',
      price: 79.99,
      duration: 50,
      isPublished: true
    });

    const course4 = await Course.create({
      tutorId: tutor2.id,
      title: 'Linear Algebra Fundamentals',
      description: 'Learn the fundamentals of linear algebra including vectors, matrices, and systems of equations',
      category: 'Mathematics',
      level: 'beginner',
      price: 59.99,
      duration: 35,
      isPublished: true
    });
    console.log('✓ Sample courses created');

    // Create sample marketplace items
    await MarketplaceItem.create({
      sellerId: learner1.id,
      title: 'Introduction to Algorithms Textbook',
      description: 'Used textbook in good condition. No highlighting or notes.',
      category: 'Books',
      itemType: 'book',
      condition: 'good',
      price: 45.00,
      location: 'Campus Library Area',
      contactInfo: 'mike.davis@unihub.com',
      isAvailable: true
    });

    await MarketplaceItem.create({
      sellerId: learner2.id,
      title: 'Scientific Calculator - TI-84 Plus',
      description: 'Graphing calculator in excellent condition. Includes manual and USB cable.',
      category: 'Electronics',
      itemType: 'electronics',
      condition: 'like_new',
      price: 75.00,
      location: 'Science Building',
      contactInfo: 'emily.brown@unihub.com',
      isAvailable: true
    });

    await MarketplaceItem.create({
      sellerId: learner1.id,
      title: 'Computer Science Notes - Full Semester',
      description: 'Complete handwritten notes for CS101. Well organized and comprehensive.',
      category: 'Study Materials',
      itemType: 'notes',
      condition: 'good',
      price: 15.00,
      location: 'Computer Science Building',
      contactInfo: 'mike.davis@unihub.com',
      isAvailable: true
    });
    console.log('✓ Sample marketplace items created');

    console.log('\n=================================');
    console.log('Seeding completed successfully!');
    console.log('=================================');
    console.log('\nTest Accounts:');
    console.log('\nAdmin:');
    console.log('  Email: admin@unihub.com');
    console.log('  Password: admin123');
    console.log('\nTutors:');
    console.log('  Email: john.smith@unihub.com');
    console.log('  Password: tutor123');
    console.log('  Email: sarah.johnson@unihub.com');
    console.log('  Password: tutor123');
    console.log('\nLearners:');
    console.log('  Email: mike.davis@unihub.com');
    console.log('  Password: learner123');
    console.log('  Email: emily.brown@unihub.com');
    console.log('  Password: learner123');
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
