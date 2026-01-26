const { MarketplaceItem, User, VendorProfile, Order } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

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
      stock: stock || 0
    });

    res.status(201).json({
      success: true,
      message: 'Marketplace listing created successfully',
      data: { item }
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
    
    const where = { isAvailable: true };
    
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
          attributes: ['id', 'title', 'images', 'category']
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'firstName', 'lastName', 'email']
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
          attributes: ['id', 'title', 'images', 'category']
        },
        {
          model: User,
          as: 'buyer',
          attributes: ['id', 'firstName', 'lastName', 'email']
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

module.exports = {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  getMyListings,
  createOrder,
  getMyOrders,
  getMySales,
  updateOrderStatus
};
