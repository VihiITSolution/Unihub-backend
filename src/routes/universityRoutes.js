const express = require('express');
const router = express.Router();
const universityController = require('../controllers/universityController');

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

module.exports = router;
