const sequelize = require("../config/sequelize");
const User = require("./User");
const Course = require("./Course");
const CourseContent = require("./CourseContent");
const Enrollment = require("./Enrollment");
const Payment = require("./Payment");
const MarketplaceItem = require("./MarketplaceItem");
const StudentProfile = require("./StudentProfile");
const TutorProfile = require("./TutorProfile");
const VendorProfile = require("./VendorProfile");
const Order = require("./Order");
const LiveSession = require("./LiveSession");
const SessionEnrollment = require("./SessionEnrollment");
const BoardingPlace = require("./BoardingPlace");
const Review = require("./Review");
const Faculty = require("./Faculty");
const Department = require("./Department");
const University = require("./University");
const Notification = require("./Notification");
const Category = require("./Category");
const Conversation = require("./Conversation");
const Message = require("./Message");
const MessageAttachment = require("./MessageAttachment");
const BlockedMessageLog = require("./BlockedMessageLog");

// User - Profile relationships
User.hasOne(StudentProfile, { foreignKey: "userId", as: "studentProfile" });
StudentProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasOne(TutorProfile, { foreignKey: "userId", as: "tutorProfile" });
TutorProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasOne(VendorProfile, { foreignKey: "userId", as: "vendorProfile" });
VendorProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

// TutorProfile - Admin approval relationship
User.hasMany(TutorProfile, { foreignKey: "approvedBy", as: "approvedTutors" });
TutorProfile.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

// VendorProfile - Admin approval relationship
User.hasMany(VendorProfile, {
  foreignKey: "approvedBy",
  as: "approvedVendors",
});
VendorProfile.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

// User - Course relationship (Tutor creates courses)
User.hasMany(Course, { foreignKey: "tutorId", as: "courses" });
Course.belongsTo(User, { foreignKey: "tutorId", as: "tutor" });

// Faculty - Department relationship
Faculty.hasMany(Department, { foreignKey: "facultyId", as: "departments" });
Department.belongsTo(Faculty, { foreignKey: "facultyId", as: "faculty" });

// Faculty - Course relationship
Faculty.hasMany(Course, { foreignKey: "facultyId", as: "courses" });
Course.belongsTo(Faculty, { foreignKey: "facultyId", as: "faculty" });

// Department - Course relationship
Department.hasMany(Course, { foreignKey: "departmentId", as: "courses" });
Course.belongsTo(Department, { foreignKey: "departmentId", as: "department" });

// Faculty - User relationship (Created by)
User.hasMany(Faculty, { foreignKey: "createdBy", as: "createdFaculties" });
Faculty.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

// Course - Admin approval relationship
User.hasMany(Course, { foreignKey: "approvedBy", as: "approvedCourses" });
Course.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

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

// MarketplaceItem - Admin approval relationship
User.hasMany(MarketplaceItem, {
  foreignKey: "approvedBy",
  as: "approvedMarketplaceItems",
});
MarketplaceItem.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

// MarketplaceItem - Payment relationship
MarketplaceItem.hasMany(Payment, {
  foreignKey: "marketplaceItemId",
  as: "payments",
});
Payment.belongsTo(MarketplaceItem, {
  foreignKey: "marketplaceItemId",
  as: "marketplaceItem",
});

// MarketplaceItem current payment (one-to-one for ad fee payment)
MarketplaceItem.belongsTo(Payment, {
  foreignKey: "paymentId",
  as: "currentPayment",
});
Payment.hasOne(MarketplaceItem, {
  foreignKey: "paymentId",
  as: "listingForPayment",
});

// Order relationships
User.hasMany(Order, { foreignKey: "buyerId", as: "purchases" });
Order.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });

User.hasMany(Order, { foreignKey: "sellerId", as: "sales" });
Order.belongsTo(User, { foreignKey: "sellerId", as: "seller" });

MarketplaceItem.hasMany(Order, { foreignKey: "itemId", as: "orders" });
Order.belongsTo(MarketplaceItem, { foreignKey: "itemId", as: "item" });

Order.belongsTo(Payment, { foreignKey: "paymentId", as: "payment" });
Payment.hasOne(Order, { foreignKey: "paymentId", as: "order" });

// LiveSession relationships
User.hasMany(LiveSession, { foreignKey: "tutorId", as: "liveSessions" });
LiveSession.belongsTo(User, { foreignKey: "tutorId", as: "tutor" });

Course.hasMany(LiveSession, { foreignKey: "courseId", as: "liveSessions" });
LiveSession.belongsTo(Course, { foreignKey: "courseId", as: "course" });

LiveSession.hasMany(SessionEnrollment, {
  foreignKey: "sessionId",
  as: "enrollments",
});
SessionEnrollment.belongsTo(LiveSession, {
  foreignKey: "sessionId",
  as: "session",
});

User.hasMany(SessionEnrollment, {
  foreignKey: "studentId",
  as: "sessionEnrollments",
});
SessionEnrollment.belongsTo(User, { foreignKey: "studentId", as: "student" });

User.hasMany(SessionEnrollment, {
  foreignKey: "invitedBy",
  as: "sentInvitations",
});
SessionEnrollment.belongsTo(User, { foreignKey: "invitedBy", as: "inviter" });

// User - BoardingPlace relationship (Vendor creates boarding listings)
User.hasMany(BoardingPlace, { foreignKey: "vendorId", as: "boardingPlaces" });
BoardingPlace.belongsTo(User, { foreignKey: "vendorId", as: "vendor" });

// Review relationships
User.hasMany(Review, { foreignKey: "userId", as: "reviews" });
Review.belongsTo(User, { foreignKey: "userId", as: "user" });

Course.hasMany(Review, { foreignKey: "courseId", as: "reviews" });
Review.belongsTo(Course, { foreignKey: "courseId", as: "course" });

// Notification relationships
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Category relationships
User.hasMany(Category, {
  foreignKey: "createdByTutorId",
  as: "createdCategories",
});
Category.belongsTo(User, { foreignKey: "createdByTutorId", as: "creator" });

Course.belongsTo(Category, { foreignKey: "category", as: "categoryObj" });
Category.hasMany(Course, { foreignKey: "category", as: "courses" });

// Conversation relationships (chat feature)
User.hasMany(Conversation, {
  foreignKey: "participantOneId",
  as: "conversationsAsOne",
});
Conversation.belongsTo(User, {
  foreignKey: "participantOneId",
  as: "participantOne",
});

User.hasMany(Conversation, {
  foreignKey: "participantTwoId",
  as: "conversationsAsTwo",
});
Conversation.belongsTo(User, {
  foreignKey: "participantTwoId",
  as: "participantTwo",
});

Conversation.belongsTo(User, { foreignKey: "flaggedBy", as: "flagger" });

Conversation.hasMany(Message, {
  foreignKey: "conversationId",
  as: "messages",
});
Message.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});

User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });

Message.hasMany(MessageAttachment, {
  foreignKey: "messageId",
  as: "attachments",
});
MessageAttachment.belongsTo(Message, {
  foreignKey: "messageId",
  as: "message",
});

Conversation.hasMany(BlockedMessageLog, {
  foreignKey: "conversationId",
  as: "blockedAttempts",
});
BlockedMessageLog.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});

User.hasMany(BlockedMessageLog, {
  foreignKey: "senderId",
  as: "blockedMessageAttempts",
});
BlockedMessageLog.belongsTo(User, { foreignKey: "senderId", as: "sender" });

BlockedMessageLog.belongsTo(User, {
  foreignKey: "reviewedByAdminId",
  as: "reviewer",
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
  TutorProfile,
  VendorProfile,
  Order,
  LiveSession,
  SessionEnrollment,
  BoardingPlace,
  Review,
  Faculty,
  Department,
  University,
  Notification,
  Category,
  Conversation,
  Message,
  MessageAttachment,
  BlockedMessageLog,
};
