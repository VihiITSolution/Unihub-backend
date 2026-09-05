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
const SupportTicket = require("./SupportTicket");
const Post = require("./Post");
const PostLike = require("./PostLike");
const PostComment = require("./PostComment");
const Follow = require("./Follow");
const CourseNotifyRequest = require("./CourseNotifyRequest");
const YouTubeRightsDeclaration = require("./YouTubeRightsDeclaration");
const AdminAuditLog = require("./AdminAuditLog");
const MeetingOrganizerAccount = require("./MeetingOrganizerAccount");
const LiveSessionMeeting = require("./LiveSessionMeeting");
const UserMeetingIdentity = require("./UserMeetingIdentity");
const LiveSessionProviderJob = require("./LiveSessionProviderJob");
const LiveSessionEvent = require("./LiveSessionEvent");
const VerificationChallenge = require("./VerificationChallenge");
const AffiliateCampaign = require("./AffiliateCampaign");
const AffiliateAccount = require("./AffiliateAccount");
const AffiliateReferral = require("./AffiliateReferral");
const AffiliateRiskFlag = require("./AffiliateRiskFlag");
const AffiliatePayoutProfile = require("./AffiliatePayoutProfile");
const AffiliatePayoutRequest = require("./AffiliatePayoutRequest");
const AffiliateLedgerEntry = require("./AffiliateLedgerEntry");

// User - Profile relationships
User.hasOne(StudentProfile, { foreignKey: "userId", as: "studentProfile" });
StudentProfile.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(VerificationChallenge, { foreignKey: "userId", as: "verificationChallenges" });
VerificationChallenge.belongsTo(User, { foreignKey: "userId", as: "user" });

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

// Retained copyright declaration for externally linked YouTube lessons
User.hasOne(YouTubeRightsDeclaration, {
  foreignKey: "userId",
  as: "youtubeRightsDeclaration",
});
YouTubeRightsDeclaration.belongsTo(User, { foreignKey: "userId", as: "user" });
YouTubeRightsDeclaration.hasMany(CourseContent, {
  foreignKey: "youtubeRightsDeclarationId",
  as: "courseContents",
});
CourseContent.belongsTo(YouTubeRightsDeclaration, {
  foreignKey: "youtubeRightsDeclarationId",
  as: "youtubeRightsDeclaration",
});

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

User.hasMany(LiveSession, { foreignKey: "approvedBy", as: "approvedLiveSessions" });
LiveSession.belongsTo(User, { foreignKey: "approvedBy", as: "liveSessionApprover" });

LiveSession.hasOne(LiveSessionMeeting, { foreignKey: "sessionId", as: "meeting" });
LiveSessionMeeting.belongsTo(LiveSession, { foreignKey: "sessionId", as: "session" });
MeetingOrganizerAccount.hasMany(LiveSessionMeeting, { foreignKey: "organizerAccountId", as: "meetings" });
LiveSessionMeeting.belongsTo(MeetingOrganizerAccount, { foreignKey: "organizerAccountId", as: "organizer" });

User.hasMany(UserMeetingIdentity, { foreignKey: "userId", as: "meetingIdentities" });
UserMeetingIdentity.belongsTo(User, { foreignKey: "userId", as: "user" });

LiveSession.hasMany(LiveSessionProviderJob, { foreignKey: "sessionId", as: "providerJobs" });
LiveSessionProviderJob.belongsTo(LiveSession, { foreignKey: "sessionId", as: "session" });
LiveSession.hasMany(LiveSessionEvent, { foreignKey: "sessionId", as: "events" });
LiveSessionEvent.belongsTo(LiveSession, { foreignKey: "sessionId", as: "session" });
User.hasMany(LiveSessionEvent, { foreignKey: "actorUserId", as: "liveSessionEvents" });
LiveSessionEvent.belongsTo(User, { foreignKey: "actorUserId", as: "actor" });

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

// SupportTicket relationships
User.hasMany(SupportTicket, { foreignKey: "userId", as: "supportTickets" });
SupportTicket.belongsTo(User, { foreignKey: "userId", as: "user" });
SupportTicket.belongsTo(User, {
  foreignKey: "assignedToAdminId",
  as: "assignedAdmin",
});
SupportTicket.belongsTo(User, {
  foreignKey: "lastUpdatedByAdminId",
  as: "lastUpdatedByAdmin",
});
User.hasMany(AdminAuditLog, { foreignKey: "actorAdminId", as: "adminAuditLogs" });
AdminAuditLog.belongsTo(User, { foreignKey: "actorAdminId", as: "actorAdmin" });

User.hasOne(AffiliateAccount, { foreignKey: "userId", as: "affiliateAccount" });
AffiliateAccount.belongsTo(User, { foreignKey: "userId", as: "user" });
AffiliateCampaign.hasMany(AffiliateReferral, { foreignKey: "campaignId", as: "referrals" });
AffiliateReferral.belongsTo(AffiliateCampaign, { foreignKey: "campaignId", as: "campaign" });
AffiliateReferral.belongsTo(User, { foreignKey: "referrerUserId", as: "referrer" });
AffiliateReferral.belongsTo(User, { foreignKey: "referredUserId", as: "referred" });
AffiliateReferral.hasMany(AffiliateRiskFlag, { foreignKey: "referralId", as: "riskFlags" });
AffiliateRiskFlag.belongsTo(AffiliateReferral, { foreignKey: "referralId", as: "referral" });
User.hasOne(AffiliatePayoutProfile, { foreignKey: "userId", as: "affiliatePayoutProfile" });
AffiliatePayoutProfile.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(AffiliatePayoutRequest, { foreignKey: "userId", as: "affiliatePayoutRequests" });
AffiliatePayoutRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
AffiliatePayoutRequest.hasMany(AffiliateRiskFlag, { foreignKey: "payoutRequestId", as: "riskFlags" });
AffiliateRiskFlag.belongsTo(AffiliatePayoutRequest, { foreignKey: "payoutRequestId", as: "payoutRequest" });

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

// CourseNotifyRequest associations
User.hasMany(CourseNotifyRequest, { foreignKey: "userId", as: "notifyRequests" });
CourseNotifyRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
Course.hasMany(CourseNotifyRequest, { foreignKey: "courseId", as: "notifyRequests" });
CourseNotifyRequest.belongsTo(Course, { foreignKey: "courseId", as: "course" });

// Social associations
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
Post.belongsTo(User, { foreignKey: "userId", as: "author" });

Post.hasMany(PostLike, { foreignKey: "postId", as: "likes" });
PostLike.belongsTo(Post, { foreignKey: "postId", as: "post" });
PostLike.belongsTo(User, { foreignKey: "userId", as: "liker" });

Post.hasMany(PostComment, { foreignKey: "postId", as: "comments" });
PostComment.belongsTo(Post, { foreignKey: "postId", as: "post" });
PostComment.belongsTo(User, { foreignKey: "userId", as: "author" });

Follow.belongsTo(User, { foreignKey: "followerId", as: "follower" });
Follow.belongsTo(User, { foreignKey: "followingId", as: "followee" });

module.exports = {
  sequelize,
  User,
  Post,
  PostLike,
  PostComment,
  Follow,
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
  MeetingOrganizerAccount,
  LiveSessionMeeting,
  UserMeetingIdentity,
  LiveSessionProviderJob,
  LiveSessionEvent,
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
  SupportTicket,
  CourseNotifyRequest,
  YouTubeRightsDeclaration,
  AdminAuditLog,
  VerificationChallenge,
  AffiliateCampaign,
  AffiliateAccount,
  AffiliateReferral,
  AffiliateRiskFlag,
  AffiliatePayoutProfile,
  AffiliatePayoutRequest,
  AffiliateLedgerEntry,
};
