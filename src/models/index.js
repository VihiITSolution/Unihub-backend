const sequelize = require('../config/sequelize');
const User = require('./User');
const Course = require('./Course');
const Enrollment = require('./Enrollment');
const Payment = require('./Payment');
const MarketplaceItem = require('./MarketplaceItem');
const StudentProfile = require('./StudentProfile');
const TutorProfile = require('./TutorProfile');

// User - Profile relationships
User.hasOne(StudentProfile, { foreignKey: 'userId', as: 'studentProfile' });
StudentProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(TutorProfile, { foreignKey: 'userId', as: 'tutorProfile' });
TutorProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// TutorProfile - Admin approval relationship
User.hasMany(TutorProfile, { foreignKey: 'approvedBy', as: 'approvedTutors' });
TutorProfile.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

// User - Course relationship (Tutor creates courses)
User.hasMany(Course, { foreignKey: "tutorId", as: "courses" });
Course.belongsTo(User, { foreignKey: "tutorId", as: "tutor" });

// Course - CourseContent relationship
Course.hasMany(CourseContent, { foreignKey: "courseId", as: "contents" });
CourseContent.belongsTo(Course, { foreignKey: "courseId", as: "course" });

// User - Enrollment relationship (Learner enrolls in courses)
User.hasMany(Enrollment, { foreignKey: "learnerId", as: "enrollments" });
Enrollment.belongsTo(User, { foreignKey: "learnerId", as: "learner" });

// Course - Enrollment relationship
Course.hasMany(Enrollment, { foreignKey: "courseId", as: "enrollments" });
Enrollment.belongsTo(Course, { foreignKey: "courseId", as: "course" });

// User - Payment relationship
User.hasMany(Payment, { foreignKey: "userId", as: "payments" });
Payment.belongsTo(User, { foreignKey: "userId", as: "user" });

// Enrollment - Payment relationship
Enrollment.hasMany(Payment, { foreignKey: "enrollmentId", as: "payments" });
Payment.belongsTo(Enrollment, { foreignKey: "enrollmentId", as: "enrollment" });

// User - MarketplaceItem relationship (Seller lists items)
User.hasMany(MarketplaceItem, {
  foreignKey: "sellerId",
  as: "marketplaceItems",
});
MarketplaceItem.belongsTo(User, { foreignKey: "sellerId", as: "seller" });

// MarketplaceItem - Payment relationship
MarketplaceItem.hasMany(Payment, {
  foreignKey: "marketplaceItemId",
  as: "payments",
});
Payment.belongsTo(MarketplaceItem, {
  foreignKey: "marketplaceItemId",
  as: "marketplaceItem",
});

module.exports = {
  sequelize,
  User,
  Course,
  CourseContent,
  Enrollment,
  Payment,
  MarketplaceItem,
  StudentProfile,
  TutorProfile
};

