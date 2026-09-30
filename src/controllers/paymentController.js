const { Payment, Enrollment, Course, MarketplaceItem, User } = require("../models");
const crypto = require("crypto");
const payhereService = require('../services/payhere.service');
const helapayService = require('../services/helapay.service');
const { calculateExpirationDate } = require('./marketplaceController');
const { notifyApprovalByEmail } = require('../services/approvalEmail.service');

// Replace uuid with crypto for generating unique IDs
const uuidv4 = () => crypto.randomUUID();

/**
 * Create a payment
 */
const createPayment = async (req, res, next) => {
  try {
    const { enrollmentId, marketplaceItemId, amount, paymentMethod } = req.body;

    if (!enrollmentId && !marketplaceItemId) {
      return res.status(400).json({
        success: false,
        message: "Either enrollmentId or marketplaceItemId is required",
      });
    }

    let actualAmount = amount;

    if (enrollmentId) {
      const enrollment = await Enrollment.findByPk(enrollmentId, {
        include: [{ model: Course, as: "course" }],
      });

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Enrollment not found",
        });
      }

      if (enrollment.learnerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized",
        });
      }

      actualAmount = enrollment.course.price;
    }

    if (marketplaceItemId) {
      const item = await MarketplaceItem.findByPk(marketplaceItemId);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Marketplace item not found",
        });
      }

      actualAmount = item.price;
    }

    const transactionId = `TXN-${uuidv4()}`;

    const payment = await Payment.create({
      userId: req.user.id,
      enrollmentId,
      marketplaceItemId,
      amount: actualAmount,
      currency: "LKR",
      paymentMethod,
      transactionId,
      status: "completed",
      paymentGateway: "mock",
      paidAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Payment processed successfully",
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Enrollment,
          as: "enrollment",
          include: [
            {
              model: Course,
              as: "course",
            },
          ],
        },
        {
          model: MarketplaceItem,
          as: "marketplaceItem",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by ID
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: Enrollment,
          as: "enrollment",
          include: [
            {
              model: Course,
              as: "course",
            },
          ],
        },
        {
          model: MarketplaceItem,
          as: "marketplaceItem",
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process payment through selected gateway
 */
const processPayment = async (req, res, next) => {
  try {
    const { id } = req.params; // Payment ID
    
    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: MarketplaceItem,
          as: 'marketplaceItem'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        }
      ]
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (payment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed'
      });
    }
    
    const gateway = payment.paymentGateway;
    
    // Process based on gateway
    if (gateway === 'payhere') {
      if (!payhereService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'PayHere payment gateway is not configured'
        });
      }
      
      const paymentData = await payhereService.initializePayment({
        orderId: payment.transactionId || `MP-${payment.id}`,
        amount: payment.amount,
        currency: payment.currency,
        itemName: payment.marketplaceItem ? payment.marketplaceItem.title : 'Marketplace Item',
        firstName: payment.user.firstName,
        lastName: payment.user.lastName,
        email: payment.user.email,
        phone: payment.user.phoneNumber || '',
        address: '',
        city: '',
        country: 'Sri Lanka'
      });
      
      return res.status(200).json({
        success: true,
        message: 'PayHere payment initialized',
        data: paymentData
      });
      
    } else if (gateway === 'helapay') {
      if (!helapayService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'HelaPay payment gateway is not configured'
        });
      }
      
      const paymentResponse = await helapayService.createPaymentRequest({
        orderId: payment.transactionId || `MP-${payment.id}`,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.marketplaceItem ? payment.marketplaceItem.title : 'Marketplace Item',
        customerName: `${payment.user.firstName} ${payment.user.lastName}`,
        customerEmail: payment.user.email,
        customerPhone: payment.user.phoneNumber || '',
        metadata: {
          paymentId: payment.id,
          marketplaceItemId: payment.marketplaceItemId
        }
      });
      
      // Update payment with transaction ID from HelaPay
      if (paymentResponse.transactionId) {
        payment.transactionId = paymentResponse.transactionId;
        await payment.save();
      }
      
      return res.status(200).json({
        success: true,
        message: 'HelaPay payment initialized',
        data: paymentResponse
      });
      
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported payment gateway: ${gateway}`
      });
    }
    
  } catch (error) {
    console.error('Payment processing error:', error);
    next(error);
  }
};

/**
 * PayHere webhook handler
 */
const webhookPayHere = async (req, res) => {
  try {
    const notificationData = req.body;
    
    // Verify notification
    if (!payhereService.verifyNotification(notificationData)) {
      console.error('Invalid PayHere notification signature');
      return res.status(400).send('Invalid signature');
    }
    
    // Process notification
    const paymentInfo = payhereService.processNotification(notificationData);
    
    // Find payment by order ID or transaction ID
    const payment = await Payment.findOne({
      where: {
        transactionId: paymentInfo.orderId
      },
      include: [
        {
          model: MarketplaceItem,
          as: 'marketplaceItem'
        }
      ]
    });
    
    if (!payment) {
      console.error(`Payment not found for order ID: ${paymentInfo.orderId}`);
      return res.status(404).send('Payment not found');
    }
    
    // Update payment status
    payment.status = paymentInfo.status;
    payment.paidAt = paymentInfo.status === 'completed' ? new Date() : null;
    payment.metadata = JSON.stringify({
      ...JSON.parse(payment.metadata || '{}'),
      payhere: paymentInfo
    });
    await payment.save();
    
    // If payment completed, update marketplace item
    if (paymentInfo.status === 'completed' && payment.marketplaceItem) {
      const item = payment.marketplaceItem;
      item.isPaid = true;
      item.paidAt = new Date();
      item.expiresAt = calculateExpirationDate();
      // Keep approval status as pending for admin review
      await item.save();
    }
    
    console.log(`PayHere payment ${paymentInfo.status} for order ${paymentInfo.orderId}`);
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('PayHere webhook error:', error);
    res.status(500).send('Internal server error');
  }
};

/**
 * HelaPay webhook handler
 */
const webhookHelaPay = async (req, res) => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    // Verify webhook signature
    if (!helapayService.verifyWebhookSignature(webhookData, signature, timestamp)) {
      console.error('Invalid HelaPay webhook signature');
      return res.status(400).send('Invalid signature');
    }
    
    // Process webhook
    const paymentInfo = helapayService.processWebhook(webhookData);
    
    // Find payment by transaction ID
    const payment = await Payment.findOne({
      where: {
        transactionId: paymentInfo.transactionId
      },
      include: [
        {
          model: MarketplaceItem,
          as: 'marketplaceItem'
        }
      ]
    });
    
    if (!payment) {
      console.error(`Payment not found for transaction ID: ${paymentInfo.transactionId}`);
      return res.status(404).send('Payment not found');
    }
    
    // Update payment status
    payment.status = paymentInfo.status;
    payment.paidAt = paymentInfo.status === 'completed' ? paymentInfo.paidAt : null;
    payment.metadata = JSON.stringify({
      ...JSON.parse(payment.metadata || '{}'),
      helapay: paymentInfo
    });
    await payment.save();
    
    // If payment completed, update marketplace item
    if (paymentInfo.status === 'completed' && payment.marketplaceItem) {
      const item = payment.marketplaceItem;
      item.isPaid = true;
      item.paidAt = new Date();
      item.expiresAt = calculateExpirationDate();
      // Keep approval status as pending for admin review
      await item.save();
    }
    
    console.log(`HelaPay payment ${paymentInfo.status} for transaction ${paymentInfo.transactionId}`);
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('HelaPay webhook error:', error);
    res.status(500).send('Internal server error');
  }
};

/**
 * Verify bank transfer (Admin only)
 */
const verifyBankTransfer = async (req, res, next) => {
  try {
    const { id } = req.params; // Payment ID
    const { approved, rejectionReason } = req.body;
    
    // Check admin authorization
    const isAdmin = req.user.primaryRole === 'admin' || (req.user.roles && req.user.roles.includes('admin'));
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: MarketplaceItem,
          as: 'marketplaceItem'
        }
      ]
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (payment.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({
        success: false,
        message: 'This payment is not a bank transfer'
      });
    }
    
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed'
      });
    }
    
    // Update payment status
    payment.status = approved ? 'completed' : 'failed';
    payment.paidAt = approved ? new Date() : null;
    
    const metadata = JSON.parse(payment.metadata || '{}');
    metadata.verifiedBy = req.user.id;
    metadata.verifiedAt = new Date();
    if (!approved && rejectionReason) {
      metadata.rejectionReason = rejectionReason;
    }
    payment.metadata = JSON.stringify(metadata);
    await payment.save();
    const emailSent = approved
      ? await notifyApprovalByEmail(payment.userId, 'bankTransfer')
      : false;
    
    // If approved, update marketplace item
    if (approved && payment.marketplaceItem) {
      const item = payment.marketplaceItem;
      item.isPaid = true;
      item.paidAt = new Date();
      item.expiresAt = calculateExpirationDate();
      // Keep approval status as pending for admin review
      await item.save();
    }

    res.status(200).json({
      success: true,
      message: approved ? 'Bank transfer verified successfully' : 'Bank transfer rejected',
      data: { payment, emailSent }
    });
    
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayment,
  getPaymentHistory,
  getPaymentById,
  processPayment,
  webhookPayHere,
  webhookHelaPay,
  verifyBankTransfer
};
