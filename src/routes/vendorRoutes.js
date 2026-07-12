const express = require('express');
const { body } = require('express-validator');
const {
  createVendorProfile,
  getMyVendorProfile,
  getVendorProfileByUserId,
  updateVendorProfile,
  getVendorStats
} = require('../controllers/vendorController');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { isValidPhone } = require('../utils/fieldValidators');

const router = express.Router();

// Letters/digits, may contain spaces & &'.,- in the middle; 3-60 chars total,
// must start/end alphanumeric (rejects things like "@#Store!" or a 1-char name).
const SHOP_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\s&'.,-]{1,58}[a-zA-Z0-9]$/;

/**
 * @swagger
 * /api/profile/vendor:
 *   post:
 *     tags: [Vendor Profile]
 *     summary: Create vendor profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopName
 *             properties:
 *               shopName:
 *                 type: string
 *               shopDescription:
 *                 type: string
 *               businessType:
 *                 type: string
 *                 enum: [individual, business]
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               taxId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vendor profile created successfully
 */
router.post(
  '/',
  authMiddleware,
  [
    body('shopName')
      .trim()
      .notEmpty()
      .withMessage('Shop name is required')
      .bail()
      .matches(SHOP_NAME_REGEX)
      .withMessage('Shop name must be 3-60 characters and start/end with a letter or number'),
    body('shopDescription').optional().isString(),
    body('businessType').optional().isIn(['individual', 'business']),
    body('contactEmail').optional().isEmail().withMessage('Invalid email format'),
    body('contactPhone')
      .optional({ checkFalsy: true })
      .custom(isValidPhone)
      .withMessage('Enter a valid phone number'),
    validate
  ],
  createVendorProfile
);

/**
 * @swagger
 * /api/profile/vendor:
 *   get:
 *     tags: [Vendor Profile]
 *     summary: Get my vendor profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor profile retrieved successfully
 */
router.get('/', authMiddleware, getMyVendorProfile);

/**
 * @swagger
 * /api/profile/vendor:
 *   put:
 *     tags: [Vendor Profile]
 *     summary: Update vendor profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopName:
 *                 type: string
 *               shopDescription:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vendor profile updated successfully
 */
router.put(
  '/',
  authMiddleware,
  [
    body('shopName')
      .optional({ checkFalsy: true })
      .trim()
      .matches(SHOP_NAME_REGEX)
      .withMessage('Shop name must be 3-60 characters and start/end with a letter or number'),
    body('contactEmail').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    body('contactPhone')
      .optional({ checkFalsy: true })
      .custom(isValidPhone)
      .withMessage('Enter a valid phone number'),
    validate
  ],
  updateVendorProfile,
);

/**
 * @swagger
 * /api/profile/vendor/stats:
 *   get:
 *     tags: [Vendor Profile]
 *     summary: Get vendor statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor statistics retrieved successfully
 */
router.get('/stats', authMiddleware, getVendorStats);

/**
 * @swagger
 * /api/profile/vendor/{userId}:
 *   get:
 *     tags: [Vendor Profile]
 *     summary: Get vendor profile by user ID (public)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vendor profile retrieved successfully
 */
router.get('/:userId', getVendorProfileByUserId);

module.exports = router;
