const { Payment, Enrollment, Course, MarketplaceItem } = require("../models");
const crypto = require("crypto");

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
      currency: "USD",
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

module.exports = {
  createPayment,
  getPaymentHistory,
  getPaymentById,
};
