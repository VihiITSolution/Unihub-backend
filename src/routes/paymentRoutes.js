const express = require('express');
const { body } = require('express-validator');
const { 
  createPayment, 
  getPaymentHistory, 
  getPaymentById,
  processPayment,
  webhookPayHere,
  webhookHelaPay,
  verifyBankTransfer
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   post:
 *     tags: [Payments]
 *     summary: Create a payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enrollmentId:
 *                 type: integer
 *               marketplaceItemId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment processed successfully
 */
router.post(
  '/',
  authMiddleware,
  createLimiter,
  [
    body('paymentMethod').optional().trim(),
    validate
  ],
  createPayment
);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/', authMiddleware, getPaymentHistory);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
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
 *         description: Payment details
 */
router.get('/:id', authMiddleware, getPaymentById);

/**
 * @swagger
 * /api/payments/{id}/process:
 *   post:
 *     tags: [Payments]
 *     summary: Process payment through gateway
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
 *         description: Payment processing initialized
 */
router.post('/:id/process', authMiddleware, processPayment);

/**
 * @swagger
 * /api/payments/webhook/payhere:
 *   post:
 *     tags: [Payments]
 *     summary: PayHere webhook endpoint (public)
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook/payhere', webhookPayHere);

/**
 * @swagger
 * /api/payments/webhook/helapay:
 *   post:
 *     tags: [Payments]
 *     summary: HelaPay webhook endpoint (public)
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook/helapay', webhookHelaPay);

/**
 * @swagger
 * /api/payments/{id}/verify:
 *   put:
 *     tags: [Payments]
 *     summary: Verify bank transfer (Admin only)
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
 *               - approved
 *             properties:
 *               approved:
 *                 type: boolean
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank transfer verified
 */
router.put(
  '/:id/verify',
  authMiddleware,
  [
    body('approved').isBoolean().withMessage('Approved status is required'),
    body('rejectionReason').optional().trim(),
    validate
  ],
  verifyBankTransfer
);

module.exports = router;
