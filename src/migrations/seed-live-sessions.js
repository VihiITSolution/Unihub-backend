require('dotenv').config();
const { User, LiveSession } = require('../models');

/**
 * Populates a handful of upcoming live sessions so the Live Sessions page
 * (session cards, enroll/join buttons, free/paid filters) has real data to
 * test against. Every QA test case for that page was failing "No live
 * sessions available" - not because of a broken query or filter (there is
 * no approval/active gate on this model, unlike Boarding), but simply
 * because the live_sessions table is created empty by
 * create-live-sessions.js and nothing else in this codebase ever inserts a
 * row into it outside of the real "tutor creates a session" API flow.
 *
 * Run manually against a dev/QA database: node src/migrations/seed-live-sessions.js
 * Do NOT run this against production.
 */
const seedLiveSessions = async () => {
  try {
    console.log('Seeding live sessions...');

    const [tutorUser] = await User.findOrCreate({
      where: { email: 'sessions.tutor@unihub.com' },
      defaults: {
        firstName: 'Live',
        lastName: 'Tutor',
        email: 'sessions.tutor@unihub.com',
        password: 'tutor123',
        roles: ['tutor'],
        primaryRole: 'tutor',
        bio: 'Runs live Q&A and revision sessions.',
        isVerified: true,
        isActive: true,
      },
    });

    const inDays = (days, hours = 0) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);

    const sessions = [
      {
        title: 'Free Intro to Computer Networks Q&A',
        description: 'Open Q&A session covering the basics of computer networks.',
        scheduledStartTime: inDays(2),
        scheduledEndTime: inDays(2, 1),
        isFree: true,
        price: 0,
        maxAttendees: 100,
      },
      {
        title: 'Advanced Database Design Workshop',
        description: 'Deep dive into normalization, indexing, and query optimization.',
        scheduledStartTime: inDays(3),
        scheduledEndTime: inDays(3, 2),
        isFree: false,
        price: 1500,
        maxAttendees: 50,
      },
      {
        title: 'Exam Revision: Data Structures',
        description: 'Free revision session ahead of the mid-term exam.',
        scheduledStartTime: inDays(5),
        scheduledEndTime: inDays(5, 1),
        isFree: true,
        price: 0,
        maxAttendees: 200,
      },
      {
        title: 'Paid Mentoring: Final Year Project Guidance',
        description: 'Small-group mentoring session for final year project planning.',
        scheduledStartTime: inDays(7),
        scheduledEndTime: inDays(7, 1),
        isFree: false,
        price: 2500,
        maxAttendees: 20,
      },
    ];

    for (const session of sessions) {
      await LiveSession.findOrCreate({
        where: { tutorId: tutorUser.id, title: session.title },
        defaults: {
          ...session,
          tutorId: tutorUser.id,
          status: 'scheduled',
        },
      });
    }

    console.log(`Seeded ${sessions.length} scheduled live sessions for tutor ${tutorUser.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Live session seed failed!');
    if (error.name === 'SequelizeValidationError') {
      console.error('Validation Errors:', error.errors.map((e) => `${e.path}: ${e.message}`));
    }
    console.error(error);
    process.exit(1);
  }
};

seedLiveSessions();
