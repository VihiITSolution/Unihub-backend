const { VendorProfile, User } = require('../models');

/**
 * Create vendor profile
 */
const createVendorProfile = async (req, res, next) => {
  try {
    // Check if vendor profile already exists
    const existingProfile = await VendorProfile.findOne({ where: { userId: req.user.id } });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Vendor profile already exists. Use update endpoint instead.'
      });
    }

    const {
      shopName,
      shopDescription,
      businessType,
      contactEmail,
      contactPhone,
      address,
      city,
      country,
      postalCode,
      taxId
    } = req.body;

    // Create vendor profile
    const vendorProfile = await VendorProfile.create({
      userId: req.user.id,
      shopName,
      shopDescription,
      businessType,
      contactEmail: contactEmail || req.user.email,
      contactPhone,
      address,
      city,
      country,
      postalCode,
      taxId,
      isProfileComplete: true,
      approvalStatus: 'approved', // Auto-approve for now
      isApproved: true
    });

    // Update user's vendor profile completion status
    await User.update(
      { 
        isVendorProfileComplete: true,
        roles: req.user.roles ? [...new Set([...req.user.roles, 'vendor'])] : ['student', 'vendor']
      },
      { where: { id: req.user.id } }
    );

    res.status(201).json({
      success: true,
      message: 'Vendor profile created successfully',
      data: { vendorProfile }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my vendor profile
 */
const getMyVendorProfile = async (req, res, next) => {
  try {
    const vendorProfile = await VendorProfile.findOne({
      where: { userId: req.user.id }
    });

    if (!vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { vendorProfile }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor profile by user ID (Public)
 */
const getVendorProfileByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const vendorProfile = await VendorProfile.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'profileImage']
      }]
    });

    if (!vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Only return public information
    const publicProfile = {
      shopName: vendorProfile.shopName,
      shopDescription: vendorProfile.shopDescription,
      city: vendorProfile.city,
      country: vendorProfile.country,
      totalSales: vendorProfile.totalSales,
      averageRating: vendorProfile.averageRating,
      totalReviews: vendorProfile.totalReviews,
      user: vendorProfile.user
    };

    res.status(200).json({
      success: true,
      data: { vendorProfile: publicProfile }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor profile
 */
const updateVendorProfile = async (req, res, next) => {
  try {
    const vendorProfile = await VendorProfile.findOne({ where: { userId: req.user.id } });

    if (!vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found. Create one first.'
      });
    }

    const {
      shopName,
      shopDescription,
      businessType,
      contactEmail,
      contactPhone,
      address,
      city,
      country,
      postalCode,
      taxId,
      isActive
    } = req.body;

    // Update fields
    if (shopName) vendorProfile.shopName = shopName;
    if (shopDescription) vendorProfile.shopDescription = shopDescription;
    if (businessType) vendorProfile.businessType = businessType;
    if (contactEmail) vendorProfile.contactEmail = contactEmail;
    if (contactPhone) vendorProfile.contactPhone = contactPhone;
    if (address) vendorProfile.address = address;
    if (city) vendorProfile.city = city;
    if (country) vendorProfile.country = country;
    if (postalCode) vendorProfile.postalCode = postalCode;
    if (taxId) vendorProfile.taxId = taxId;
    if (isActive !== undefined) vendorProfile.isActive = isActive;

    await vendorProfile.save();

    res.status(200).json({
      success: true,
      message: 'Vendor profile updated successfully',
      data: { vendorProfile }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor statistics
 */
const getVendorStats = async (req, res, next) => {
  try {
    const vendorProfile = await VendorProfile.findOne({ where: { userId: req.user.id } });

    if (!vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalSales: vendorProfile.totalSales,
          totalRevenue: vendorProfile.totalRevenue,
          averageRating: vendorProfile.averageRating,
          totalReviews: vendorProfile.totalReviews
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVendorProfile,
  getMyVendorProfile,
  getVendorProfileByUserId,
  updateVendorProfile,
  getVendorStats
};
