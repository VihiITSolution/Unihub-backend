const { User, Course, Enrollment, Payment, MarketplaceItem } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;
    
    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: {
        users,
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
 * Update user status (Admin only)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, isVerified } = req.body;

    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (isVerified !== undefined) user.isVerified = isVerified;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform statistics (Admin only)
 */
const getStatistics = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const totalTutors = await User.count({ where: { role: 'tutor' } });
    const totalLearners = await User.count({ where: { role: 'learner' } });
    const totalCourses = await Course.count();
    const publishedCourses = await Course.count({ where: { isPublished: true } });
    const totalEnrollments = await Enrollment.count();
    const totalPayments = await Payment.count();
    const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } });
    const totalMarketplaceItems = await MarketplaceItem.count();

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          tutors: totalTutors,
          learners: totalLearners
        },
        courses: {
          total: totalCourses,
          published: publishedCourses
        },
        enrollments: totalEnrollments,
        payments: {
          total: totalPayments,
          revenue: totalRevenue || 0
        },
        marketplace: {
          totalItems: totalMarketplaceItems
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all courses for moderation (Admin only)
 */
const getAllCourses = async (req, res, next) => {
  try {
    const { isPublished, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (isPublished !== undefined) where.isPublished = isPublished === 'true';

    const offset = (page - 1) * limit;
    
    const { count, rows: courses } = await Course.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'tutor',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: {
        courses,
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
 * Get all marketplace items for moderation (Admin only)
 */
const getAllMarketplaceItems = async (req, res, next) => {
  try {
    const { isAvailable, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';

    const offset = (page - 1) * limit;
    
    const { count, rows: items } = await MarketplaceItem.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'seller',
        attributes: ['id', 'firstName', 'lastName', 'email']
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

module.exports = {
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getStatistics,
  getAllCourses,
  getAllMarketplaceItems
};
