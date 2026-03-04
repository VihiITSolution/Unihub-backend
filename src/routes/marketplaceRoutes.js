const express = require('express');
const { body } = require('express-validator');
const { 
  createListing, 
  getListings, 
  getListingById, 
  updateListing, 
  deleteListing, 
  getMyListings,
  createOrder,
  getMyOrders,
  getMySales,
  updateOrderStatus,
  getListingPaymentInfo,
  submitBankTransferProof,
  initiatePayment
} = require('../controllers/marketplaceController');
const { authMiddleware } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * /api/marketplace:
 *   post:
 *     tags: [Marketplace]
 *     summary: Create marketplace listing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - itemType
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               itemType:
 *                 type: string
 *                 enum: [book, notes, equipment, electronics, other]
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, good, fair, poor]
 *               price:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               location:
 *                 type: string
 *               contactInfo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Listing created successfully
 */
router.post(
  '/',
  authMiddleware,
  createLimiter,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('itemType').isIn(['book', 'notes', 'equipment', 'electronics', 'other']).withMessage('Invalid item type'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    validate
  ],
  createListing
);

/**
 * @swagger
 * /api/marketplace:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get all marketplace listings
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
router.get('/', getListings);

/**
 * @swagger
 * /api/marketplace/my-listings:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get my listings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's listings
 */
router.get('/my-listings', authMiddleware, getMyListings);

/**
 * @swagger
 * /api/marketplace/{id}:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get listing by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Listing details
 */
router.get('/:id', getListingById);

/**
 * @swagger
 * /api/marketplace/{id}:
 *   put:
 *     tags: [Marketplace]
 *     summary: Update listing
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
 *         description: Listing updated successfully
 */
router.put('/:id', authMiddleware, updateListing);

/**
 * @swagger
 * /api/marketplace/{id}:
 *   delete:
 *     tags: [Marketplace]
 *     summary: Delete listing
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
 *         description: Listing deleted successfully
 */
router.delete('/:id', authMiddleware, deleteListing);

/**
 * @swagger
 * /api/marketplace/orders:
 *   post:
 *     tags: [Marketplace]
 *     summary: Create order for marketplace item
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *               - quantity
 *             properties:
 *               itemId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               shippingAddress:
 *                 type: string
 *               buyerNotes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post(
  '/orders',
  authMiddleware,
  [
    body('itemId').isInt().withMessage('Item ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('shippingAddress').optional().isString(),
    validate
  ],
  createOrder
);

/**
 * @swagger
 * /api/marketplace/orders:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get my orders (buyer view)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
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
 *         description: List of orders
 */
router.get('/orders', authMiddleware, getMyOrders);

/**
 * @swagger
 * /api/marketplace/sales:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get my sales (seller view)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
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
 *         description: List of sales
 */
router.get('/sales', authMiddleware, getMySales);

/**
 * @swagger
 * /api/marketplace/orders/{id}:
 *   put:
 *     tags: [Marketplace]
 *     summary: Update order status (seller only)
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
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, shipped, delivered, cancelled, refunded]
 *               trackingNumber:
 *                 type: string
 *               sellerNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated successfully
 */
router.put(
  '/orders/:id',
  authMiddleware,
  [
    body('status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded']),
    validate
  ],
  updateOrderStatus
);

/**
 * @swagger
 * /api/marketplace/{id}/payment-info:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get payment information for a listing
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
 *         description: Payment information retrieved
 */
router.get('/:id/payment-info', authMiddleware, getListingPaymentInfo);

/**
 * @swagger
 * /api/marketplace/{id}/pay:
 *   post:
 *     tags: [Marketplace]
 *     summary: Initiate payment for a listing
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
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [payhere, helapay]
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 */
router.post(
  '/:id/pay',
  authMiddleware,
  [
    body('paymentMethod').isIn(['payhere', 'helapay']).withMessage('Invalid payment method'),
    validate
  ],
  initiatePayment
);

/**
 * @swagger
 * /api/marketplace/{id}/bank-transfer:
 *   post:
 *     tags: [Marketplace]
 *     summary: Submit bank transfer proof for listing payment
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
 *             required:
 *               - proofImageUrl
 *               - referenceNumber
 *               - transferDate
 *             properties:
 *               proofImageUrl:
 *                 type: string
 *               referenceNumber:
 *                 type: string
 *               transferDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank transfer proof submitted
 */
router.post(
  '/:id/bank-transfer',
  authMiddleware,
  [
    body('proofImageUrl').trim().notEmpty().withMessage('Proof image is required'),
    body('referenceNumber').trim().notEmpty().withMessage('Reference number is required'),
    body('transferDate').isISO8601().withMessage('Valid transfer date is required'),
    validate
  ],
  submitBankTransferProof
);

module.exports = router;
