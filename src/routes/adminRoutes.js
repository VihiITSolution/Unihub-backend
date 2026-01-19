const express = require('express');
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
  getCourseDetails
} = require('../controllers/adminController');
const { authMiddleware, authorize } = require('../middleware/auth');

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
router.get('/users', authMiddleware, authorize('admin'), getAllUsers);

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
router.put('/users/:id/status', authMiddleware, authorize('admin'), updateUserStatus);

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
router.delete('/users/:id', authMiddleware, authorize('admin'), deleteUser);

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
router.get('/statistics', authMiddleware, authorize('admin'), getStatistics);

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
router.get('/courses', authMiddleware, authorize('admin'), getAllCourses);

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
router.get('/marketplace', authMiddleware, authorize('admin'), getAllMarketplaceItems);

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
router.get('/courses/pending', authMiddleware, authorize('admin'), getPendingCourses);

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
router.put('/courses/:id/approve', authMiddleware, authorize('admin'), approveCourse);

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
router.put('/courses/:id/reject', authMiddleware, authorize('admin'), rejectCourse);

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
router.get('/courses/:id/details', authMiddleware, authorize('admin'), getCourseDetails);

module.exports = router;
