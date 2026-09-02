const BoardingPlace = require('../models/BoardingPlace');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const { Op } = require('sequelize');
const { isFreeTrialActive, calculateFreeTrialExpirationDate } = require('./marketplaceController');

// @desc    Upload images for a boarding place listing
// @route   POST /api/boarding/upload-images
// @access  Private (Vendors only)
exports.uploadBoardingImages = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const images = files.map((file) => file.path);

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images }
    });
  } catch (error) {
    console.error('Upload boarding images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading images',
      error: error.message
    });
  }
};

// @desc    Upload videos for a boarding place listing
// @route   POST /api/boarding/upload-videos
// @access  Private (Vendors only)
exports.uploadBoardingVideos = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No videos uploaded'
      });
    }

    const videos = files.map((file) => file.path);

    res.status(200).json({
      success: true,
      message: 'Videos uploaded successfully',
      data: { videos }
    });
  } catch (error) {
    console.error('Upload boarding videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading videos',
      error: error.message
    });
  }
};

// @desc    Create new boarding place listing
// @route   POST /api/boarding/places
// @access  Private (Vendors only)
exports.createBoardingPlace = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user has vendor profile
    const vendorProfile = await VendorProfile.findOne({ where: { userId } });
    if (!vendorProfile || !vendorProfile.isProfileComplete) {
      return res.status(403).json({
        success: false,
        message: 'You must complete your vendor profile first'
      });
    }

    const {
      title, description, address, city, district, nearestUniversity,
      distanceToUniversity, roomType, genderPreference, capacity,
      monthlyRent, securityDeposit, amenities, rules, images, videos,
      contactPhone, contactEmail
    } = req.body;

    // Calculate available slots (initially same as capacity)
    const availableSlots = capacity;

    const freeTrial = isFreeTrialActive();

    // Create boarding place
    const boardingPlace = await BoardingPlace.create({
      vendorId: userId,
      title,
      description,
      address,
      city,
      district,
      nearestUniversity,
      distanceToUniversity,
      roomType,
      genderPreference,
      capacity,
      availableSlots,
      monthlyRent,
      securityDeposit: securityDeposit || 0,
      amenities: amenities || [],
      rules,
      images: images || [],
      videos: videos || [],
      contactPhone,
      contactEmail,
      isActive: freeTrial,
      isPaid: freeTrial,
      adFee: freeTrial ? 0 : (process.env.BOARDING_AD_FEE || 50.00),
      isFreeTrialAd: freeTrial,
      approvalStatus: 'pending',
      expiresAt: null // set on admin approval
    });

    res.status(201).json({
      success: true,
      message: freeTrial
        ? 'Boarding place submitted! It will be reviewed and listed free for 3 months.'
        : 'Boarding place created. Please complete payment to activate.',
      boardingPlace,
      paymentRequired: !freeTrial,
      adFee: freeTrial ? 0 : boardingPlace.adFee,
      isFreeTrialAd: freeTrial
    });
  } catch (error) {
    console.error('Create boarding place error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating boarding place',
      error: error.message
    });
  }
};

// @desc    Process payment for boarding place listing
// @route   POST /api/boarding/places/:id/pay
// @access  Private (Vendors only)
exports.payForListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { paymentMethod, transactionId } = req.body;

    const boardingPlace = await BoardingPlace.findByPk(id);

    if (!boardingPlace) {
      return res.status(404).json({
        success: false,
        message: 'Boarding place not found'
      });
    }

    // Check ownership
    if (boardingPlace.vendorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (boardingPlace.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'This listing is already paid'
      });
    }

    // Update listing as paid (in production, integrate with payment gateway)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    await boardingPlace.update({
      isPaid: true,
      paidAt: new Date(),
      expiresAt,
      isActive: true, // Activate listing
      approvalStatus: 'pending' // Send for admin approval
    });

    // TODO: Create payment record in Payment model

    res.json({
      success: true,
      message: 'Payment successful! Your listing is now active and pending admin approval.',
      boardingPlace
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  }
};

// @desc    Get all boarding places (public, with filters)
// @route   GET /api/boarding/places
// @access  Public
exports.getBoardingPlaces = async (req, res) => {
  try {
    const {
      city,
      roomType,
      genderPreference,
      minRent,
      maxRent,
      nearestUniversity,
      page = 1,
      limit = 12
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {
      isActive: true,
      [Op.or]: [{ isPaid: true }, { isFreeTrialAd: true }],
      approvalStatus: 'approved',
      expiresAt: { [Op.gt]: new Date() }
    };

    // Apply filters
    if (city) where.city = city;
    if (roomType) where.roomType = roomType;
    if (genderPreference) where.genderPreference = genderPreference;
    if (nearestUniversity) where.nearestUniversity = { [Op.like]: `%${nearestUniversity}%` };
    if (minRent || maxRent) {
      where.monthlyRent = {};
      if (minRent) where.monthlyRent[Op.gte] = minRent;
      if (maxRent) where.monthlyRent[Op.lte] = maxRent;
    }

    const { count, rows: places } = await BoardingPlace.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'vendor',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      places,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get boarding places error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching boarding places',
      error: error.message
    });
  }
};

// @desc    Get single boarding place details
// @route   GET /api/boarding/places/:id
// @access  Public
exports.getBoardingPlaceById = async (req, res) => {
  try {
    const { id } = req.params;

    const place = await BoardingPlace.findByPk(id, {
      include: [{
        model: User,
        as: 'vendor',
        attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'],
        include: [{
          model: VendorProfile,
          as: 'vendorProfile',
          attributes: ['shopName', 'contactPhone', 'contactEmail']
        }]
      }]
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Boarding place not found'
      });
    }

    // Increment view count
    await place.increment('viewCount');

    res.json({
      success: true,
      place
    });
  } catch (error) {
    console.error('Get boarding place error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching boarding place',
      error: error.message
    });
  }
};

// @desc    Get vendor's own boarding listings
// @route   GET /api/boarding/my-listings
// @access  Private (Vendors only)
exports.getMyBoardingListings = async (req, res) => {
  try {
    const userId = req.user.id;

    const places = await BoardingPlace.findAll({
      where: { vendorId: userId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      places
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your listings',
      error: error.message
    });
  }
};

// @desc    Update boarding place
// @route   PATCH /api/boarding/places/:id
// @access  Private (Vendors only)
exports.updateBoardingPlace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const place = await BoardingPlace.findByPk(id);

    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Boarding place not found'
      });
    }

    // Check ownership
    if (place.vendorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'address', 'city', 'district',
      'nearestUniversity', 'distanceToUniversity', 'roomType',
      'genderPreference', 'capacity', 'availableSlots', 'monthlyRent',
      'securityDeposit', 'amenities', 'rules', 'images', 'videos',
      'contactPhone', 'contactEmail', 'isActive'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        place[field] = req.body[field];
      }
    });

    await place.save();

    res.json({
      success: true,
      message: 'Boarding place updated successfully',
      place
    });
  } catch (error) {
    console.error('Update boarding place error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating boarding place',
      error: error.message
    });
  }
};

// @desc    Delete boarding place
// @route   DELETE /api/boarding/places/:id
// @access  Private (Listing owner or admin)
exports.deleteBoardingPlace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const place = await BoardingPlace.findByPk(id);

    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Boarding place not found'
      });
    }

    const isAdmin =
      req.user.primaryRole === 'admin' ||
      (Array.isArray(req.user.roles) && req.user.roles.includes('admin'));

    // Only the listing owner or an administrator can permanently delete it.
    if (place.vendorId !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await place.destroy();

    res.json({
      success: true,
      message: 'Boarding place deleted successfully'
    });
  } catch (error) {
    console.error('Delete boarding place error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting boarding place',
      error: error.message
    });
  }
};

// @desc    Increment inquiry count
// @route   POST /api/boarding/places/:id/inquire
// @access  Public
exports.incrementInquiry = async (req, res) => {
  try {
    const { id } = req.params;

    const place = await BoardingPlace.findByPk(id);

    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Boarding place not found'
      });
    }

    await place.increment('inquiryCount');

    res.json({
      success: true,
      message: 'Inquiry recorded'
    });
  } catch (error) {
    console.error('Inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording inquiry',
      error: error.message
    });
  }
};
