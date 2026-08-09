const express = require('express');
const router = express.Router();
const universityController = require('../controllers/universityController');
const { authMiddleware, authorize } = require('../middleware/auth');
const { auditAdminAction } = require('../middleware/adminAudit');

/**
 * @swagger
 * /api/universities:
 *   get:
 *     summary: Get all universities
 *     tags: [Universities]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [public, private, international]
 *         description: Filter by university type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or short name
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of universities
 */
router.get('/', universityController.getAllUniversities);

/**
 * @swagger
 * /api/universities/nearest:
 *   get:
 *     summary: Get nearest universities based on coordinates
 *     tags: [Universities]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: User's latitude
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: User's longitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 50
 *         description: Search radius in kilometers
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: List of nearest universities with distances
 */
router.get('/nearest', universityController.getNearestUniversities);

/**
 * @swagger
 * /api/universities/cities:
 *   get:
 *     summary: Get list of cities with universities
 *     tags: [Universities]
 *     responses:
 *       200:
 *         description: List of cities
 */
router.get('/cities', universityController.getUniversityCities);

/**
 * @swagger
 * /api/universities/{id}:
 *   get:
 *     summary: Get university by ID
 *     tags: [Universities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: University details
 *       404:
 *         description: University not found
 */
router.get('/:id', universityController.getUniversityById);

// ========== ADMIN ROUTES ==========

/**
 * @swagger
 * /api/universities:
 *   post:
 *     summary: Create new university (Admin only)
 *     tags: [Universities - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - city
 *               - latitude
 *               - longitude
 *             properties:
 *               name:
 *                 type: string
 *               shortName:
 *                 type: string
 *               city:
 *                 type: string
 *               district:
 *                 type: string
 *               province:
 *                 type: string
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [public, private, international]
 *               website:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: University created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/', authMiddleware, authorize('admin'), auditAdminAction('university.created', 'university', 'Created a university'), universityController.createUniversity);

/**
 * @swagger
 * /api/universities/{id}:
 *   put:
 *     summary: Update university (Admin only)
 *     tags: [Universities - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: University updated successfully
 *       404:
 *         description: University not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put('/:id', authMiddleware, authorize('admin'), auditAdminAction('university.updated', 'university', 'Updated a university'), universityController.updateUniversity);

/**
 * @swagger
 * /api/universities/{id}:
 *   delete:
 *     summary: Delete university (Admin only)
 *     tags: [Universities - Admin]
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
 *         description: University deleted successfully
 *       404:
 *         description: University not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/:id', authMiddleware, authorize('admin'), auditAdminAction('university.deleted', 'university', 'Deleted a university'), universityController.deleteUniversity);

/**
 * @swagger
 * /api/universities/{id}/toggle-status:
 *   patch:
 *     summary: Toggle university active status (Admin only)
 *     tags: [Universities - Admin]
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
 *         description: University status toggled successfully
 *       404:
 *         description: University not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.patch('/:id/toggle-status', authMiddleware, authorize('admin'), auditAdminAction('university.status_toggled', 'university', 'Toggled university status'), universityController.toggleUniversityStatus);

module.exports = router;
