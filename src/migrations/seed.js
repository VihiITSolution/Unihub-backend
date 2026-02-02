require('dotenv').config();
const { User, Course, MarketplaceItem, CourseContent } = require('../models');


const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@unihub.com',
      password: 'admin123',
      roles: ['admin'],
      primaryRole: 'admin',
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
      roles: ['tutor'],
      primaryRole: 'tutor',
      bio: 'Experienced software developer and instructor',
      isVerified: true,
      isActive: true
    });

    const tutor2 = await User.create({
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@unihub.com',
      password: 'tutor123',
      roles: ['tutor'],
      primaryRole: 'tutor',
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
      roles: ['student'],
      primaryRole: 'student',
      isVerified: true,
      isActive: true
    });

    const learner2 = await User.create({
      firstName: 'Emily',
      lastName: 'Brown',
      email: 'emily.brown@unihub.com',
      password: 'learner123',
      roles: ['student'],
      primaryRole: 'student',
      isVerified: true,
      isActive: true
    });

    console.log('✓ Learner users created');

    // Create sample courses
    const course1 = await Course.create({
      tutorId: tutor1.id,
      title: 'Introduction to Web Development',
      description: 'Learn the basics of HTML, CSS, and JavaScript to build modern websites. This course covers everything from basic syntax to advanced layouts.',
      category: 'web-dev',
      level: 'beginner',
      price: 49.99,
      duration: 1200, // 20 hours
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
      rating: 4.8,
      enrollmentCount: 1250,
      approvalStatus: 'approved',
      isPublished: true
    });

    const course2 = await Course.create({
      tutorId: tutor1.id,
      title: 'Advanced React & Next.js',
      description: 'Master modern React patterns, Server Components, and Next.js App Router. Build high-performance applications with ease.',
      category: 'web-dev',
      level: 'advanced',
      price: 89.99,
      duration: 1500, // 25 hours
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80',
      rating: 4.9,
      enrollmentCount: 850,
      approvalStatus: 'approved',
      isPublished: true
    });

    const course3 = await Course.create({
      tutorId: tutor2.id,
      title: 'Data Science Fundamentals',
      description: 'Start your journey into data science. Learn Python, Pandas, and Scikit-Learn to analyze and visualize data.',
      category: 'data-science',
      level: 'beginner',
      price: 59.99,
      duration: 1800, // 30 hours
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bb8c803er9a8?auto=format&fit=crop&w=800&q=80',
      rating: 4.7,
      enrollmentCount: 2100,
      approvalStatus: 'approved',
      isPublished: true
    });

    const course4 = await Course.create({
      tutorId: tutor2.id,
      title: 'Business Strategy 101',
      description: 'Learn how to develop and implement effective business strategies. Perfect for entrepreneurs and business students.',
      category: 'business',
      level: 'intermediate',
      price: 69.99,
      duration: 900, // 15 hours
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
      rating: 4.6,
      enrollmentCount: 540,
      approvalStatus: 'approved',
      isPublished: true
    });

    // Create course contents
    await CourseContent.create({
      courseId: course1.id,
      title: '1. Getting Started with HTML',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=kUMe1FH4CHE',
      duration: 45,
      order: 1
    });

    await CourseContent.create({
      courseId: course1.id,
      title: '2. CSS Fundamentals',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=1Rs2ND1ryYc',
      duration: 60,
      order: 2
    });

    await CourseContent.create({
      courseId: course2.id,
      title: '1. Introduction to Next.js',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
      duration: 30,
      order: 1
    });

    await CourseContent.create({
      courseId: course3.id,
      title: '1. Python for Data Science',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
      duration: 120,
      order: 1
    });

    console.log('✓ Sample courses and content created');


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
    console.error('Seeding failed!');
    if (error.name === 'SequelizeValidationError') {
      console.error('Validation Errors:', error.errors.map(e => `${e.path}: ${e.message}`));
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('Unique Constraint Errors:', error.errors.map(e => `${e.path}: ${e.message}`));
    } else {
      console.error(error);
    }
    process.exit(1);
  }

};

seedData();
