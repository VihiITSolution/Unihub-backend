const { MarketplaceItem, User, VendorProfile, Order, Payment } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * Helper: Check if category requires payment
 */
const checkCategoryRequiresPayment = (category) => {
  const paidCategories = process.env.MARKETPLACE_PAID_CATEGORIES || '';
  
  // If empty, all categories require payment (default behavior)
  if (!paidCategories.trim()) {
    return true;
  }
  
  // Check if this category is in the paid list
  const paidList = paidCategories.split(',').map(cat => cat.trim().toLowerCase());
  return paidList.includes(category.toLowerCase());
};

/**
 * Helper: Calculate ad fee based on configuration
 */
const calculateAdFee = (category, itemPrice) => {
  // Check if this category requires payment
  if (!checkCategoryRequiresPayment(category)) {
    return 0;
  }
  
  const feeType = process.env.MARKETPLACE_AD_FEE_TYPE || 'fixed';
  
  switch (feeType) {
    case 'percentage':
      const percentage = parseFloat(process.env.MARKETPLACE_AD_FEE_PERCENTAGE || 5);
      return (itemPrice * percentage) / 100;
      
    case 'free':
      return 0;
      
    case 'fixed':
    default:
      return parseFloat(process.env.MARKETPLACE_AD_FEE_AMOUNT || 50.00);
  }
};

/**
 * Helper: Calculate expiration date
 */
const calculateExpirationDate = () => {
  const durationDays = parseInt(process.env.MARKETPLACE_AD_DURATION_DAYS || 30);

  if (durationDays === 0) {
    return null; // No expiration
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  return expiresAt;
};

/**
 * Helper: Check if the limited-time free trial promotion is active
 */
const isFreeTrialActive = () => {
  if (process.env.FREE_TRIAL_ENABLED !== 'true') return false;

  const endDate = process.env.FREE_TRIAL_END_DATE;
  if (endDate && new Date() > new Date(endDate)) return false;

  return true;
};

/**
 * Helper: Calculate 3-month expiration date from a given base date
 */
const calculateFreeTrialExpirationDate = (baseDate = new Date()) => {
  const expiry = new Date(baseDate);
  expiry.setMonth(expiry.getMonth() + 3);
  return expiry;
};

/**
 * Upload marketplace listing images to Cloudinary and return their URLs.
 * Called before createListing/updateListing so the resulting URLs can be
 * included in that (JSON, not multipart) request body.
 */
const uploadListingImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded',
      });
    }

    const images = files.map((file) => file.path);

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create marketplace listing (Vendor only)
 */
const createListing = async (req, res, next) => {
  try {
    // Check if user has vendor profile
    const vendorProfile = await VendorProfile.findOne({ where: { userId: req.user.id } });
    
    if (!vendorProfile || !vendorProfile.isProfileComplete) {
      return res.status(403).json({
        success: false,
        message: 'Please complete your vendor profile before creating listings'
      });
    }

    if (!vendorProfile.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account is not active'
      });
    }

    const { title, description, category, itemType, condition, price, images, location, contactInfo, stock } = req.body;

    // During the free trial promotion every ad is free and goes straight to pending admin review
    const freeTrial = isFreeTrialActive();

    const requiresPayment = freeTrial ? false : checkCategoryRequiresPayment(category);
    const adFee = freeTrial ? 0 : calculateAdFee(category, price);

    // Free trial and free-category ads are pre-paid; paid-category ads wait for payment
    const isPaid = freeTrial || !checkCategoryRequiresPayment(category);
    // Free trial ads always need admin approval; free-category ads are auto-approved
    const approvalStatus = (freeTrial || checkCategoryRequiresPayment(category)) ? 'pending' : 'approved';

    const item = await MarketplaceItem.create({
      sellerId: req.user.id,
      title,
      description,
      category,
      itemType,
      condition,
      price,
      images,
      location,
      contactInfo,
      stock: stock || 0,
      requiresPayment,
      adFee,
      isPaid,
      approvalStatus,
      expiresAt: null, // Set on approval for free trial; set after payment for paid ads
      paidAt: isPaid ? new Date() : null,
      isFreeTrialAd: freeTrial
    });

    let responseMessage;
    if (freeTrial) {
      responseMessage = 'Listing submitted for admin review. Once approved it will be live for 3 months — free as part of our limited-time promotion!';
    } else if (requiresPayment) {
      responseMessage = `Listing created successfully. Please complete payment of $${adFee.toFixed(2)} to publish.`;
    } else {
      responseMessage = 'Listing created and published successfully (free category)';
    }

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        item,
        requiresPayment,
        adFee: requiresPayment ? adFee : 0,
        isFreeTrialAd: freeTrial
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all marketplace listings with filters
 */
const getListings = async (req, res, next) => {
  try {
    const { category, itemType, condition, minPrice, maxPrice, search, page = 1, limit = 10 } = req.query;
    
    // Only show paid and approved items that haven't expired
    const where = { 
      isAvailable: true,
      isPaid: true,
      approvalStatus: 'approved',
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } }
      ]
    };
    
    if (category) where.category = category;
    if (itemType) where.itemType = itemType;
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: items } = await MarketplaceItem.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'seller',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get listing by ID
 */
const getListingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await MarketplaceItem.findByPk(id, {
      include: [{
        model: User,
        as: 'seller',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'profileImage']
      }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Increment view count atomically to avoid race conditions
    await item.increment('viewCount');

    res.status(200).json({
      success: true,
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update marketplace listing
 */
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await MarketplaceItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check authorization: seller or admin
    const isAdmin = req.user.primaryRole === 'admin' || (req.user.roles && req.user.roles.includes('admin'));
    if (item.sellerId !== req.user.id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing'
      });
    }

    const { title, description, category, itemType, condition, price, images, location, contactInfo, isAvailable, stock } = req.body;

    if (title) item.title = title;
    if (description) item.description = description;
    if (category) item.category = category;
    if (itemType) item.itemType = itemType;
    if (condition) item.condition = condition;
    if (price !== undefined) item.price = price;
    if (images) item.images = images;
    if (location) item.location = location;
    if (contactInfo) item.contactInfo = contactInfo;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;
    if (stock !== undefined) item.stock = stock;

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Listing updated successfully',
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete marketplace listing
 */
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await MarketplaceItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check authorization: seller or admin
    const isAdmin = req.user.primaryRole === 'admin' || (req.user.roles && req.user.roles.includes('admin'));
    if (item.sellerId !== req.user.id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this listing'
      });
    }

    await item.destroy();

    res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my listings
 */
const getMyListings = async (req, res, next) => {
  try {
    const items = await MarketplaceItem.findAll({
      where: { sellerId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: { items }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create order (Any authenticated user can buy)
 */
const createOrder = async (req, res, next) => {
  try {
    const { itemId, quantity, shippingAddress, buyerNotes } = req.body;

    // Get item details
    const item = await MarketplaceItem.findByPk(itemId, {
      include: [{ model: User, as: 'seller', attributes: ['id', 'firstName', 'lastName', 'email'] }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (!item.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Item is not available for purchase'
      });
    }

    // Check stock
    if (item.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${item.stock} units available`
      });
    }

    // Prevent buying from yourself
    if (item.sellerId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot purchase your own items'
      });
    }

    // Calculate prices
    const unitPrice = item.price;
    const totalPrice = unitPrice * quantity;

    // Generate order ID
    const orderId = `ORD-${crypto.randomUUID()}`;

    // Create order
    const order = await Order.create({
      orderId,
      buyerId: req.user.id,
      sellerId: item.sellerId,
      itemId: item.id,
      quantity,
      unitPrice,
      totalPrice,
      shippingAddress,
      buyerNotes,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Please proceed with payment',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my orders (Buyer view)
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const where = { buyerId: req.user.id };
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: MarketplaceItem,
          as: 'item',
          attributes: ['id', 'title', 'images', 'category'],
          required: false // Allow orders with deleted items
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false // Allow orders with deleted sellers
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my sales (Seller view)
 */
const getMySales = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const where = { sellerId: req.user.id };
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: MarketplaceItem,
          as: 'item',
          attributes: ['id', 'title', 'images', 'category'],
          required: false // Allow orders with deleted items
        },
        {
          model: User,
          as: 'buyer',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false // Allow orders with deleted buyers
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('getMySales error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales',
      error: error.message
    });
  }
};

/**
 * Update order status (Seller only)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, sellerNotes } = req.body;

    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only seller can update order status
    if (order.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }

    // Update status
    if (status) {
      order.status = status;
      
      // Update timestamps based on status
      if (status === 'confirmed') {
        order.confirmedAt = new Date();
        
        // Decrement stock when order is confirmed
        const item = await MarketplaceItem.findByPk(order.itemId);
        if (item) {
          await item.decrement('stock', { by: order.quantity });
          await item.increment('soldCount', { by: order.quantity });
        }
      } else if (status === 'shipped') {
        order.shippedAt = new Date();
      } else if (status === 'delivered') {
        order.deliveredAt = new Date();
      } else if (status === 'cancelled') {
        order.cancelledAt = new Date();
        
        // Restore stock if order was already confirmed
        if (order.confirmedAt) {
          const item = await MarketplaceItem.findByPk(order.itemId);
          if (item) {
            await item.increment('stock', { by: order.quantity });
            await item.decrement('soldCount', { by: order.quantity });
          }
        }
      }
    }

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (sellerNotes) order.sellerNotes = sellerNotes;

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment information for a listing
 */
const getListingPaymentInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const item = await MarketplaceItem.findByPk(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Check authorization: only seller can view payment info
    if (item.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view payment information for this listing'
      });
    }
    
    // Get bank details for bank transfer option
    const bankDetails = {
      bankName: process.env.BANK_NAME || 'Bank of Ceylon',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
      accountName: process.env.BANK_ACCOUNT_NAME || 'UniHub Marketplace',
      branch: process.env.BANK_BRANCH || 'Colombo',
      swiftCode: process.env.BANK_SWIFT_CODE || 'BCEYLKLX'
    };
    
    res.status(200).json({
      success: true,
      data: {
        itemId: item.id,
        title: item.title,
        category: item.category,
        price: item.price,
        requiresPayment: item.requiresPayment,
        adFee: item.adFee,
        isPaid: item.isPaid,
        paidAt: item.paidAt,
        approvalStatus: item.approvalStatus,
        expiresAt: item.expiresAt,
        paymentMethods: {
          bankTransfer: bankDetails,
          payhere: {
            available: !!process.env.PAYHERE_MERCHANT_ID,
            mode: process.env.PAYHERE_MODE || 'sandbox'
          },
          helapay: {
            available: !!process.env.HELAPAY_API_KEY,
            mode: process.env.HELAPAY_MODE || 'sandbox'
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit bank transfer proof for listing payment
 */
const submitBankTransferProof = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { proofImageUrl, referenceNumber, transferDate, notes } = req.body;
    
    const item = await MarketplaceItem.findByPk(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Check authorization: only seller
    if (item.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit payment for this listing'
      });
    }
    
    if (item.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'This listing has already been paid for'
      });
    }
    
    if (!item.requiresPayment) {
      return res.status(400).json({
        success: false,
        message: 'This listing does not require payment'
      });
    }
    
    // Create payment record with pending status
    const payment = await Payment.create({
      userId: req.user.id,
      marketplaceItemId: item.id,
      amount: item.adFee,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      paymentGateway: 'manual',
      status: 'pending',
      metadata: JSON.stringify({
        proofImageUrl,
        referenceNumber,
        transferDate,
        notes,
        itemTitle: item.title,
        submittedAt: new Date()
      })
    });
    
    // Link payment to item
    item.paymentId = payment.id;
    await item.save();
    
    res.status(200).json({
      success: true,
      message: 'Bank transfer proof submitted successfully. Pending admin verification.',
      data: { 
        payment: {
          id: payment.id,
          status: payment.status,
          method: payment.paymentMethod
        },
        item: {
          id: item.id,
          title: item.title,
          approvalStatus: item.approvalStatus
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate online payment (PayHere or HelaPay)
 * This method creates a payment record and returns payment gateway URL
 */
const initiatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body; // 'payhere' or 'helapay'
    
    const item = await MarketplaceItem.findByPk(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Check authorization: only seller
    if (item.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay for this listing'
      });
    }
    
    if (item.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'This listing has already been paid for'
      });
    }
    
    if (!item.requiresPayment) {
      return res.status(400).json({
        success: false,
        message: 'This listing does not require payment'
      });
    }
    
    // Validate payment method
    if (!['payhere', 'helapay'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Use "payhere" or "helapay"'
      });
    }
    
    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      marketplaceItemId: item.id,
      amount: item.adFee,
      currency: 'USD',
      paymentMethod: paymentMethod,
      paymentGateway: paymentMethod,
      status: 'pending',
      metadata: JSON.stringify({
        itemTitle: item.title,
        itemCategory: item.category,
        initiatedAt: new Date()
      })
    });
    
    // Link payment to item
    item.paymentId = payment.id;
    await item.save();
    
    // Payment gateway integration will be handled by payment controller
    // For now, return payment details for frontend to initiate gateway flow
    res.status(200).json({
      success: true,
      message: 'Payment initiated. Redirect to payment gateway.',
      data: {
        paymentId: payment.id,
        paymentMethod: paymentMethod,
        amount: item.adFee,
        currency: 'USD',
        itemId: item.id,
        itemTitle: item.title,
        // Frontend should call payment gateway with this info
        redirectUrl: `/api/payments/${payment.id}/process`
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadListingImages,
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
  initiatePayment,
  // Export helpers for use in other modules
  calculateAdFee,
  checkCategoryRequiresPayment,
  calculateExpirationDate,
  isFreeTrialActive,
  calculateFreeTrialExpirationDate
};
