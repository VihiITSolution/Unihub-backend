const { MarketplaceItem, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Create marketplace listing
 */
const createListing = async (req, res, next) => {
  try {
    const { title, description, category, itemType, condition, price, images, location, contactInfo } = req.body;

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
      contactInfo
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

    item.viewCount += 1;
    await item.save();

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

    if (item.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing'
      });
    }

    const { title, description, category, itemType, condition, price, images, location, contactInfo, isAvailable } = req.body;

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

    if (item.sellerId !== req.user.id && req.user.role !== 'admin') {
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

module.exports = {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  getMyListings
};
