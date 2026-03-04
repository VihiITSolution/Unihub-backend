const {
  User,
  Course,
  Enrollment,
  Payment,
  MarketplaceItem,
  TutorProfile,
  CourseContent,
} = require("../models");
const { Op } = require("sequelize");

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10 } = req.query;

    const where = {};
    if (role) where.primaryRole = role;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
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
        message: "User not found",
      });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (isVerified !== undefined) user.isVerified = isVerified;

    await user.save();

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: { user },
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
        message: "Cannot delete your own account",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
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

    // Count tutors - use primaryRole field
    const totalTutors = await User.count({
      where: { primaryRole: "tutor" },
    });

    // Count learners/students
    const totalLearners = await User.count({
      where: {
        [Op.or]: [{ primaryRole: "learner" }, { primaryRole: "student" }],
      },
    });

    const totalCourses = await Course.count();
    const publishedCourses = await Course.count({
      where: { isPublished: true },
    });

    // These might fail if tables don't exist, wrap in try-catch
    let totalEnrollments = 0;
    let totalPayments = 0;
    let totalRevenue = 0;
    let totalMarketplaceItems = 0;

    try {
      totalEnrollments = await Enrollment.count();
    } catch (e) {
      /* table might not exist */
    }

    try {
      totalPayments = await Payment.count();
      totalRevenue =
        (await Payment.sum("amount", { where: { status: "completed" } })) || 0;
    } catch (e) {
      /* table might not exist */
    }

    try {
      totalMarketplaceItems = await MarketplaceItem.count();
    } catch (e) {
      /* table might not exist */
    }

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          tutors: totalTutors,
          learners: totalLearners,
        },
        courses: {
          total: totalCourses,
          published: publishedCourses,
        },
        enrollments: totalEnrollments,
        payments: {
          total: totalPayments,
          revenue: totalRevenue || 0,
        },
        marketplace: {
          totalItems: totalMarketplaceItems,
        },
      },
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
    if (isPublished !== undefined) where.isPublished = isPublished === "true";

    const offset = (page - 1) * limit;

    const { count, rows: courses } = await Course.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "tutor",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
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
    if (isAvailable !== undefined) where.isAvailable = isAvailable === "true";

    const offset = (page - 1) * limit;

    const { count, rows: items } = await MarketplaceItem.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed course info for admin review
 */
const getCourseDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id, {
      include: [
        {
          model: User,
          as: "tutor",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "profileImage",
            "createdAt",
          ],
          include: [
            {
              model: TutorProfile,
              as: "tutorProfile",
              attributes: [
                "id",
                "userId",
                "qualifications",
                "expertiseAreas",
                "bio",
                "yearsOfExperience",
                "isApproved",
                "approvalStatus",
              ],
            },
          ],
        },
      ],
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get course contents
    const courseContent = await CourseContent.findAll({
      where: { courseId: id },
      order: [["order", "ASC"]],
    });

    // Get enrollment stats
    const enrollmentCount = await Enrollment.count({
      where: { courseId: id },
    });

    res.status(200).json({
      success: true,
      data: {
        course: {
          ...course.toJSON(),
          enrollmentCount,
        },
        courseContent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get courses pending approval (Admin only)
 */
const getPendingCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: courses } = await Course.findAndCountAll({
      where: { approvalStatus: ["draft", "pending"] },
      include: [
        {
          model: User,
          as: "tutor",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a course (Admin only)
 */
const approveCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (
      course.approvalStatus !== "pending" &&
      course.approvalStatus !== "draft"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve course with status: ${course.approvalStatus}`,
      });
    }

    course.approvalStatus = "approved";
    course.isPublished = true;
    course.approvedBy = req.user.id;
    course.approvedAt = new Date();
    course.rejectionReason = null;

    await course.save();

    res.status(200).json({
      success: true,
      message: "Course approved and published successfully",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a course (Admin only)
 */
const rejectCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (
      course.approvalStatus !== "pending" &&
      course.approvalStatus !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject course with status: ${course.approvalStatus}`,
      });
    }

    course.approvalStatus = "rejected";
    course.isPublished = false;
    course.approvedBy = req.user.id;
    course.approvedAt = new Date();
    course.rejectionReason = reason;

    await course.save();

    res.status(200).json({
      success: true,
      message: "Course rejected",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending marketplace items for approval (Admin only)
 */
const getPendingMarketplaceItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const where = {
      isPaid: true, // Only show items that have been paid for
      approvalStatus: 'pending'
    };

    const offset = (page - 1) * limit;

    const { count, rows: items } = await MarketplaceItem.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve marketplace item (Admin only)
 */
const approveMarketplaceItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await MarketplaceItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Marketplace item not found",
      });
    }

    if (!item.isPaid) {
      return res.status(400).json({
        success: false,
        message: "Item must be paid before approval",
      });
    }

    if (item.approvalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve item with status: ${item.approvalStatus}`,
      });
    }

    item.approvalStatus = 'approved';
    item.approvedBy = req.user.id;
    item.approvedAt = new Date();
    item.isAvailable = true; // Make available when approved

    await item.save();

    res.status(200).json({
      success: true,
      message: "Marketplace item approved successfully",
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject marketplace item (Admin only)
 */
const rejectMarketplaceItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const item = await MarketplaceItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Marketplace item not found",
      });
    }

    if (item.approvalStatus !== 'pending' && item.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject item with status: ${item.approvalStatus}`,
      });
    }

    item.approvalStatus = 'rejected';
    item.approvedBy = req.user.id;
    item.approvedAt = new Date();
    item.rejectionReason = reason || 'No reason provided';
    item.isAvailable = false;

    await item.save();

    res.status(200).json({
      success: true,
      message: "Marketplace item rejected",
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending bank transfers for verification (Admin only)
 */
const getPendingBankTransfers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const where = {
      paymentMethod: 'bank_transfer',
      status: 'pending'
    };

    const offset = (page - 1) * limit;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
        },
        {
          model: MarketplaceItem,
          as: "marketplaceItem",
          attributes: ["id", "title", "category", "price"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
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
  getAllMarketplaceItems,
  getPendingCourses,
  approveCourse,
  rejectCourse,
  getCourseDetails,
  getPendingMarketplaceItems,
  approveMarketplaceItem,
  rejectMarketplaceItem,
  getPendingBankTransfers
};
