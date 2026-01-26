const sequelize = require('../config/sequelize');
const User = require('./User');
const Course = require('./Course');
const CourseContent = require('./CourseContent');
const Enrollment = require('./Enrollment');
const Payment = require('./Payment');
const MarketplaceItem = require('./MarketplaceItem');
const StudentProfile = require('./StudentProfile');
const TutorProfile = require('./TutorProfile');
const VendorProfile = require('./VendorProfile');
const Order = require('./Order');
const LiveSession = require('./LiveSession');
const SessionEnrollment = require('./SessionEnrollment');
const BoardingPlace = require('./BoardingPlace');

// User - Profile relationships
User.hasOne(StudentProfile, { foreignKey: 'userId', as: 'studentProfile' });
StudentProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(TutorProfile, { foreignKey: 'userId', as: 'tutorProfile' });
TutorProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(VendorProfile, { foreignKey: 'userId', as: 'vendorProfile' });
VendorProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// TutorProfile - Admin approval relationship
User.hasMany(TutorProfile, { foreignKey: 'approvedBy', as: 'approvedTutors' });
TutorProfile.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

// VendorProfile - Admin approval relationship
User.hasMany(VendorProfile, { foreignKey: 'approvedBy', as: 'approvedVendors' });
VendorProfile.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

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

// Order relationships
User.hasMany(Order, { foreignKey: 'buyerId', as: 'purchases' });
Order.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

User.hasMany(Order, { foreignKey: 'sellerId', as: 'sales' });
Order.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

MarketplaceItem.hasMany(Order, { foreignKey: 'itemId', as: 'orders' });
Order.belongsTo(MarketplaceItem, { foreignKey: 'itemId', as: 'item' });

Order.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
Payment.hasOne(Order, { foreignKey: 'paymentId', as: 'order' });

// LiveSession relationships
User.hasMany(LiveSession, { foreignKey: 'tutorId', as: 'liveSessions' });
LiveSession.belongsTo(User, { foreignKey: 'tutorId', as: 'tutor' });

Course.hasMany(LiveSession, { foreignKey: 'courseId', as: 'liveSessions' });
LiveSession.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

LiveSession.hasMany(SessionEnrollment, { foreignKey: 'sessionId', as: 'enrollments' });
SessionEnrollment.belongsTo(LiveSession, { foreignKey: 'sessionId', as: 'session' });

User.hasMany(SessionEnrollment, { foreignKey: 'studentId', as: 'sessionEnrollments' });
SessionEnrollment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

User.hasMany(SessionEnrollment, { foreignKey: 'invitedBy', as: 'sentInvitations' });
SessionEnrollment.belongsTo(User, { foreignKey: 'invitedBy', as: 'inviter' });

// User - BoardingPlace relationship (Vendor creates boarding listings)
User.hasMany(BoardingPlace, { foreignKey: 'vendorId', as: 'boardingPlaces' });
BoardingPlace.belongsTo(User, { foreignKey: 'vendorId', as: 'vendor' });

module.exports = {
  sequelize,
  User,
  Course,
  CourseContent,
  Enrollment,
  Payment,
  MarketplaceItem,
  StudentProfile,
  TutorProfile,
  VendorProfile,
  Order,
  LiveSession,
  SessionEnrollment,
  BoardingPlace
};

