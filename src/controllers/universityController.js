const { University } = require('../models');
const { Op } = require('sequelize');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get all universities
 */
exports.getAllUniversities = async (req, res) => {
  try {
    const { city, type, search, isActive = true } = req.query;

    const where = { isActive };

    if (city) {
      where.city = { [Op.like]: `%${city}%` };
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { shortName: { [Op.like]: `%${search}%` } }
      ];
    }

    const universities = await University.findAll({
      where,
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'shortName', 'city', 'district', 'province', 
                   'latitude', 'longitude', 'type', 'website']
    });

    res.json({
      success: true,
      data: { universities },
      count: universities.length
    });
  } catch (error) {
    console.error('Error fetching universities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch universities',
      error: error.message
    });
  }
};

/**
 * Get nearest universities based on coordinates
 */
exports.getNearestUniversities = async (req, res) => {
  try {
    const { latitude, longitude, radius = 50, limit = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radiusKm = parseFloat(radius);

    // Get all active universities
    const universities = await University.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'shortName', 'city', 'district', 
                   'latitude', 'longitude', 'type', 'address', 'website']
    });

    // Calculate distance for each university
    const universitiesWithDistance = universities.map(uni => {
      const distance = calculateDistance(
        lat,
        lon,
        parseFloat(uni.latitude),
        parseFloat(uni.longitude)
      );

      return {
        ...uni.toJSON(),
        distance: parseFloat(distance.toFixed(2))
      };
    });

    // Filter by radius and sort by distance
    const nearbyUniversities = universitiesWithDistance
      .filter(uni => uni.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        universities: nearbyUniversities,
        userLocation: { latitude: lat, longitude: lon },
        radius: radiusKm
      },
      count: nearbyUniversities.length
    });
  } catch (error) {
    console.error('Error fetching nearest universities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearest universities',
      error: error.message
    });
  }
};

/**
 * Get university by ID
 */
exports.getUniversityById = async (req, res) => {
  try {
    const university = await University.findByPk(req.params.id);

    if (!university) {
      return res.status(404).json({
        success: false,
        message: 'University not found'
      });
    }

    res.json({
      success: true,
      data: { university }
    });
  } catch (error) {
    console.error('Error fetching university:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch university',
      error: error.message
    });
  }
};

/**
 * Get unique cities with universities
 */
exports.getUniversityCities = async (req, res) => {
  try {
    const cities = await University.findAll({
      where: { isActive: true },
      attributes: [
        [University.sequelize.fn('DISTINCT', University.sequelize.col('city')), 'city']
      ],
      order: [['city', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        cities: cities.map(c => c.city)
      }
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities',
      error: error.message
    });
  }
};

// ========== ADMIN OPERATIONS ==========

/**
 * Create new university (Admin only)
 */
exports.createUniversity = async (req, res) => {
  try {
    const {
      name,
      shortName,
      city,
      district,
      province,
      address,
      latitude,
      longitude,
      type,
      website,
      contactEmail,
      contactPhone,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!name || !city || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Name, city, latitude, and longitude are required'
      });
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude values'
      });
    }

    // Check for duplicate name
    const existingUni = await University.findOne({
      where: { name: { [Op.like]: name } }
    });

    if (existingUni) {
      return res.status(400).json({
        success: false,
        message: 'A university with this name already exists'
      });
    }

    const university = await University.create({
      name,
      shortName,
      city,
      district,
      province,
      address,
      latitude,
      longitude,
      type: type || 'public',
      website,
      contactEmail,
      contactPhone,
      isActive
    });

    res.status(201).json({
      success: true,
      message: 'University created successfully',
      data: { university }
    });
  } catch (error) {
    console.error('Error creating university:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create university',
      error: error.message
    });
  }
};

/**
 * Update university (Admin only)
 */
exports.updateUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const university = await University.findByPk(id);

    if (!university) {
      return res.status(404).json({
        success: false,
        message: 'University not found'
      });
    }

    // Validate coordinates if provided
    if (updateData.latitude || updateData.longitude) {
      const lat = updateData.latitude || university.latitude;
      const lon = updateData.longitude || university.longitude;
      
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude or longitude values'
        });
      }
    }

    await university.update(updateData);

    res.json({
      success: true,
      message: 'University updated successfully',
      data: { university }
    });
  } catch (error) {
    console.error('Error updating university:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update university',
      error: error.message
    });
  }
};

/**
 * Delete university (Admin only)
 */
exports.deleteUniversity = async (req, res) => {
  try {
    const { id } = req.params;

    const university = await University.findByPk(id);

    if (!university) {
      return res.status(404).json({
        success: false,
        message: 'University not found'
      });
    }

    await university.destroy();

    res.json({
      success: true,
      message: 'University deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting university:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete university',
      error: error.message
    });
  }
};

/**
 * Toggle university active status (Admin only)
 */
exports.toggleUniversityStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const university = await University.findByPk(id);

    if (!university) {
      return res.status(404).json({
        success: false,
        message: 'University not found'
      });
    }

    await university.update({ isActive: !university.isActive });

    res.json({
      success: true,
      message: `University ${university.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { university }
    });
  } catch (error) {
    console.error('Error toggling university status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle university status',
      error: error.message
    });
  }
};
