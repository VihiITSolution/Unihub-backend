const express = require("express");
const {
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getStatistics,
  getAllCourses,
  getAllMarketplaceItems,
  getPendingCourses,
  approveCourse,
  rejectCourse,
  getCourseDetails,
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
const { authMiddleware, authorize } = require("../middleware/auth");
const { auditAdminAction } = require("../middleware/adminAudit");
const {
  getSupportTickets,
  getSupportTicket,
  updateSupportTicket,
  getAdminAuditLogs,
} = require("../controllers/adminOperationsController");

const router = express.Router();

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
 *         description: Course approved
 */
router.put(
  "/courses/:id/approve",
  authMiddleware,
  authorize("admin"),
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
 *             required:
 *               - reason
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
  rejectCourse,
);

/**
 * @swagger
 * /api/admin/courses/{id}/details:
 *   get:
 *     tags: [Admin]
 *     summary: Get detailed course info for review (Admin only)
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
 *         description: Course details with tutor profile
 */
router.get(
  "/courses/:id/details",
  authMiddleware,
  authorize("admin"),
  getCourseDetails,
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
router.get("/support/tickets/:id", authMiddleware, authorize("admin"), getSupportTicket);
router.put(
  "/support/tickets/:id",
  authMiddleware,
  authorize("admin"),
  auditAdminAction("support.ticket_updated", "support_ticket", "Updated a support ticket"),
  updateSupportTicket,
);
router.get("/audit-logs", authMiddleware, authorize("admin"), getAdminAuditLogs);

module.exports = router;
