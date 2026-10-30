const express = require("express");
const {
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getStatistics,
  getAllCourses,
  getAllMarketplaceItems,
  getPendingCourses,
  approveCourse,
  rejectCourse,
  getCourseDetails,
  importCourseContentFromOneDrive,
  getPendingMarketplaceItems,
  approveMarketplaceItem,
  rejectMarketplaceItem,
  getPendingBankTransfers,
  getAllTutorProfiles,
  getTutorProfileDetails,
  approveTutorProfile,
  rejectTutorProfile,
  getPendingBoardingPlaces,
  getAllBoardingPlaces,
  approveBoardingPlace,
  rejectBoardingPlace,
  getSuggestions,
} = require("../controllers/adminController");
const {
  deleteListing: deleteMarketplaceItem,
} = require("../controllers/marketplaceController");
const { deleteCourse } = require("../controllers/courseController");
const {
  deleteBoardingPlace,
} = require("../controllers/boardingController");
const { authMiddleware, authorize } = require("../middleware/auth");
const { auditAdminAction } = require("../middleware/adminAudit");
const {
  getSupportTickets,
  getSupportTicket,
  updateSupportTicket,
  bulkUpdateSupportTickets,
  getAdminAuditLogs,
  getSystemStatus,
} = require("../controllers/adminOperationsController");
const adminLiveSessions = require("../controllers/adminLiveSessionController");
const liveSessionController = require("../controllers/liveSessionController");
const affiliateAdmin = require("../controllers/adminAffiliateController");
const microsoftDrive = require("../controllers/microsoftDriveController");
const administrators = require("../controllers/adminAdministratorController");

const router = express.Router();

router.get("/affiliate/referrals", authMiddleware, authorize("admin"), affiliateAdmin.listReferrals);
router.get("/microsoft-drive", authMiddleware, authorize("admin"), microsoftDrive.getStatus);
router.post("/microsoft-drive/authorize", authMiddleware, authorize("admin"), microsoftDrive.authorize);
router.delete("/microsoft-drive", authMiddleware, authorize("admin"), microsoftDrive.disconnect);
// Microsoft redirects here without UniHub's bearer token; the signed, short-lived
// OAuth state binds the callback to the administrator who started it.
router.get("/microsoft-drive/callback", microsoftDrive.callback);
router.post("/affiliate/referrals/:id/review", authMiddleware, authorize("admin"), auditAdminAction("affiliate.referral_reviewed", "affiliate_referral", "Reviewed an affiliate referral"), affiliateAdmin.reviewReferral);
router.get("/affiliate/payouts", authMiddleware, authorize("admin"), affiliateAdmin.listPayouts);
router.get("/affiliate/payouts/:id", authMiddleware, authorize("admin"), affiliateAdmin.payoutDetail);
router.post("/affiliate/payouts/:id/review", authMiddleware, authorize("admin"), auditAdminAction("affiliate.payout_reviewed", "affiliate_payout", "Reviewed an affiliate payout"), affiliateAdmin.reviewPayout);
router.post("/affiliate/payouts/:id/paid", authMiddleware, authorize("admin"), auditAdminAction("affiliate.payout_paid", "affiliate_payout", "Marked an affiliate payout paid"), affiliateAdmin.markPayoutPaid);

router.get("/live-sessions", authMiddleware, authorize("admin"), adminLiveSessions.list);
router.get("/live-sessions/calendar", authMiddleware, authorize("admin"), adminLiveSessions.calendar);
router.get("/live-sessions/statistics", authMiddleware, authorize("admin"), adminLiveSessions.statistics);
router.get("/live-sessions/health", authMiddleware, authorize("admin"), adminLiveSessions.health);
router.get("/live-sessions/conflicts", authMiddleware, authorize("admin"), adminLiveSessions.conflict);
router.post("/live-sessions", authMiddleware, authorize("admin"), auditAdminAction("live_session.created", "live_session", "Created a live session"), liveSessionController.createLiveSession);
router.get("/live-sessions/:id", authMiddleware, authorize("admin"), adminLiveSessions.detail);
router.put("/live-sessions/:id", authMiddleware, authorize("admin"), auditAdminAction("live_session.updated", "live_session", "Updated a live session"), liveSessionController.updateLiveSession);
router.delete("/live-sessions/:id", authMiddleware, authorize("admin"), auditAdminAction("live_session.cancelled", "live_session", "Cancelled a live session"), liveSessionController.cancelLiveSession);
router.delete("/live-sessions/:id/permanent", authMiddleware, authorize("admin"), auditAdminAction("live_session.deleted", "live_session", "Permanently deleted a live session"), adminLiveSessions.remove);
router.post("/live-sessions/:id/approve", authMiddleware, authorize("admin"), auditAdminAction("live_session.approved", "live_session", "Approved a live session"), adminLiveSessions.approve);
router.post("/live-sessions/:id/reject", authMiddleware, authorize("admin"), auditAdminAction("live_session.rejected", "live_session", "Rejected a live session"), adminLiveSessions.reject);
router.post("/live-sessions/:id/retry", authMiddleware, authorize("admin"), auditAdminAction("live_session.provisioning_retried", "live_session", "Retried live-session provisioning"), adminLiveSessions.retry);
router.post("/live-sessions/:id/sync-attendees", authMiddleware, authorize("admin"), auditAdminAction("live_session.attendees_synced", "live_session", "Queued attendee sync"), adminLiveSessions.syncAttendees);
router.post("/live-sessions/:id/sync-artifacts", authMiddleware, authorize("admin"), auditAdminAction("live_session.artifacts_synced", "live_session", "Queued artifact sync"), adminLiveSessions.syncArtifacts);
router.post("/live-sessions/:id/resend-invitation", authMiddleware, authorize("admin"), auditAdminAction("live_session.invitation_resent", "live_session", "Resent tutor Teams invitation"), adminLiveSessions.resendTutorInvitation);
router.delete("/live-sessions/:id/recording", authMiddleware, authorize("admin"), auditAdminAction("live_session.recording_deleted", "live_session", "Deleted a live-session recording"), adminLiveSessions.removeRecording);

// Administrator access and operational-notification settings.
router.get("/administrators", authMiddleware, authorize("admin"), administrators.list);
router.post("/administrators", authMiddleware, authorize("admin"), auditAdminAction("administrator.granted", "user", "Granted administrator access"), administrators.add);
router.put("/administrators/:id", authMiddleware, authorize("admin"), auditAdminAction("administrator.updated", "user", "Updated administrator access or notifications"), administrators.update);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/users", authMiddleware, authorize("admin"), getAllUsers);
router.get("/users/:id", authMiddleware, authorize("admin"), getUserDetails);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     tags: [Admin]
 *     summary: Update user status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated
 */
router.put(
  "/users/:id/status",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("user.status_updated", "user", "Updated a user account status"),
  updateUserStatus,
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete(
  "/users/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("user.deleted", "user", "Deleted a user account"),
  deleteUser,
);

/**
 * @swagger
 * /api/admin/statistics:
 *   get:
 *     tags: [Admin]
 *     summary: Get platform statistics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 */
router.get("/statistics", authMiddleware, authorize("admin"), getStatistics);

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     tags: [Admin]
 *     summary: Get all courses for moderation (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of courses
 */
router.get("/courses", authMiddleware, authorize("admin"), getAllCourses);

router.delete(
  "/courses/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("course.deleted", "course", "Deleted a course"),
  deleteCourse,
);

/**
 * @swagger
 * /api/admin/courses/{id}/details:
 *   get:
 *     tags: [Admin]
 *     summary: Get detailed course information (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detailed course information
 */
router.get(
  "/courses/:id/details",
  authMiddleware,
  authorize("admin"),
  getCourseDetails,
);

router.post(
  "/courses/:id/content/import-onedrive",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("course_content.onedrive_imported", "course_content", "Imported course content from OneDrive"),
  importCourseContentFromOneDrive,
);

/**
 * @swagger
 * /api/admin/courses/{id}/approve:
 *   put:
 *     tags: [Admin]
 *     summary: Approve a course (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Course approved successfully
 */
router.put(
  "/courses/:id/approve",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("course.approved", "course", "Approved a course"),
  approveCourse,
);

/**
 * @swagger
 * /api/admin/courses/{id}/reject:
 *   put:
 *     tags: [Admin]
 *     summary: Reject a course (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Course rejected
 */
router.put(
  "/courses/:id/reject",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("course.rejected", "course", "Rejected or disabled a course"),
  rejectCourse,
);

/**
 * @swagger
 * /api/admin/marketplace:
 *   get:
 *     tags: [Admin]
 *     summary: Get all marketplace items for moderation (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of marketplace items
 */
router.get(
  "/marketplace",
  authMiddleware,
  authorize("admin"),
  getAllMarketplaceItems,
);

/**
 * @swagger
 * /api/admin/marketplace/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a marketplace item (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Marketplace item deleted
 *       404:
 *         description: Marketplace item not found
 */
router.delete(
  "/marketplace/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction(
    "marketplace.deleted",
    "marketplace_item",
    "Deleted a marketplace item",
  ),
  deleteMarketplaceItem,
);

/**
 * @swagger
 * /api/admin/courses/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Get courses pending approval (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending courses
 */
router.get(
  "/courses/pending",
  authMiddleware,
  authorize("admin"),
  getPendingCourses,
);

/**
 * @swagger
 * /api/admin/marketplace/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Get marketplace items pending approval (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of pending marketplace items
 */
router.get(
  "/marketplace/pending",
  authMiddleware,
  authorize("admin"),
  getPendingMarketplaceItems,
);

/**
 * @swagger
 * /api/admin/marketplace/{id}/approve:
 *   put:
 *     tags: [Admin]
 *     summary: Approve a marketplace item (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Marketplace item approved
 */
router.put(
  "/marketplace/:id/approve",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("marketplace.approved", "marketplace_item", "Approved a marketplace item"),
  approveMarketplaceItem,
);

/**
 * @swagger
 * /api/admin/marketplace/{id}/reject:
 *   put:
 *     tags: [Admin]
 *     summary: Reject a marketplace item (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Marketplace item rejected
 */
router.put(
  "/marketplace/:id/reject",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("marketplace.rejected", "marketplace_item", "Rejected a marketplace item"),
  rejectMarketplaceItem,
);

/**
 * @swagger
 * /api/admin/payments/bank-transfers/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Get pending bank transfers for verification (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of pending bank transfers
 */
router.get(
  "/payments/bank-transfers/pending",
  authMiddleware,
  authorize("admin"),
  getPendingBankTransfers,
);

/**
 * @swagger
 * /api/admin/tutor-profiles:
 *   get:
 *     tags: [Admin]
 *     summary: Get all tutor profiles (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: approvalStatus
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of tutor profiles
 */
router.get(
  "/tutor-profiles",
  authMiddleware,
  authorize("admin"),
  getAllTutorProfiles,
);

/**
 * @swagger
 * /api/admin/tutor-profiles/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get tutor profile details (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tutor profile details
 */
router.get(
  "/tutor-profiles/:id",
  authMiddleware,
  authorize("admin"),
  getTutorProfileDetails,
);

/**
 * @swagger
 * /api/admin/tutor-profiles/{id}/approve:
 *   put:
 *     tags: [Admin]
 *     summary: Approve a tutor profile (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tutor profile approved
 */
router.put(
  "/tutor-profiles/:id/approve",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("tutor.approved", "tutor_profile", "Approved a tutor application"),
  approveTutorProfile,
);

/**
 * @swagger
 * /api/admin/tutor-profiles/{id}/reject:
 *   put:
 *     tags: [Admin]
 *     summary: Reject a tutor profile (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tutor profile rejected
 */
router.put(
  "/tutor-profiles/:id/reject",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("tutor.rejected", "tutor_profile", "Rejected a tutor application"),
  rejectTutorProfile,
);

// Boarding Place management routes
router.get(
  "/boarding/places",
  authMiddleware,
  authorize("admin"),
  getAllBoardingPlaces,
);

router.get(
  "/boarding/places/pending",
  authMiddleware,
  authorize("admin"),
  getPendingBoardingPlaces,
);

router.delete(
  "/boarding/places/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction(
    "boarding.deleted",
    "boarding_place",
    "Deleted a boarding place",
  ),
  deleteBoardingPlace,
);

router.put(
  "/boarding/places/:id/approve",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("boarding.approved", "boarding_place", "Approved a boarding place"),
  approveBoardingPlace,
);

router.put(
  "/boarding/places/:id/reject",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("boarding.rejected", "boarding_place", "Rejected a boarding place"),
  rejectBoardingPlace,
);

router.get("/suggestions", authMiddleware, authorize("admin"), getSuggestions);

router.get("/support/tickets", authMiddleware, authorize("admin"), getSupportTickets);
router.put(
  "/support/tickets/bulk",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("support_ticket.bulk_updated", "support_ticket", "Bulk updated support tickets"),
  bulkUpdateSupportTickets,
);
router.get("/support/tickets/:id", authMiddleware, authorize("admin"), getSupportTicket);
router.put(
  "/support/tickets/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("support.ticket_updated", "support_ticket", "Updated a support ticket"),
  updateSupportTicket,
);
router.get("/audit-logs", authMiddleware, authorize("admin"), getAdminAuditLogs);
router.get("/system-status", authMiddleware, authorize("admin"), getSystemStatus);

module.exports = router;
