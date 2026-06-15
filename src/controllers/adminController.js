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
const { createNotification } = require("./notificationController");
const { calculateFreeTrialExpirationDate } = require("./marketplaceController");

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
      // Include paid items AND free trial ads awaiting review
      [Op.or]: [{ isPaid: true }, { isFreeTrialAd: true }],
      approvalStatus: "pending",
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

    if (!item.isPaid && !item.isFreeTrialAd) {
      return res.status(400).json({
        success: false,
        message: "Item must be paid before approval",
      });
    }

    if (item.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve item with status: ${item.approvalStatus}`,
      });
    }

    item.approvalStatus = "approved";
    item.approvedBy = req.user.id;
    item.approvedAt = new Date();
    item.isAvailable = true;

    // Set 3-month expiry from approval date for free trial ads
    if (item.isFreeTrialAd) {
      item.expiresAt = calculateFreeTrialExpirationDate(new Date());
    }

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

    if (
      item.approvalStatus !== "pending" &&
      item.approvalStatus !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject item with status: ${item.approvalStatus}`,
      });
    }

    item.approvalStatus = "rejected";
    item.approvedBy = req.user.id;
    item.approvedAt = new Date();
    item.rejectionReason = reason || "No reason provided";
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
      paymentMethod: "bank_transfer",
      status: "pending",
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

/**
 * Get all tutor profiles (Admin only)
 */
const getAllTutorProfiles = async (req, res, next) => {
  try {
    const { approvalStatus, page = 1, limit = 10 } = req.query;

    const where = {};
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const offset = (page - 1) * limit;

    const { count, rows: tutorProfiles } = await TutorProfile.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        tutorProfiles,
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
 * Get tutor profile details (Admin only)
 */
const getTutorProfileDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tutorProfile = await TutorProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "profileImage",
            "phoneNumber",
            "createdAt",
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    if (!tutorProfile) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: tutorProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve tutor profile (Admin only)
 */
const approveTutorProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("🚀 [BACKEND] Approve TutorProfile Handler Called");
    console.log("🚀 [BACKEND] Profile ID:", id);
    console.log("🚀 [BACKEND] Admin User ID:", req.user?.id);
    console.log("🚀 [BACKEND] Admin User:", req.user?.email);

    // Step 1: Fetch tutor profile
    const profile = await TutorProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!profile) {
      console.error("❌ [BACKEND] Tutor profile not found with ID:", id);
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    console.log("✅ [BACKEND] Profile found:", profile.id, profile.userId);
    console.log(
      "📝 [BACKEND] Current approval status:",
      profile.approvalStatus,
    );

    // Step 2: Check if already approved
    if (profile.approvalStatus === "approved") {
      console.warn("⚠️ [BACKEND] Profile already approved");
      return res.status(400).json({
        success: false,
        message: "Tutor profile is already approved",
      });
    }

    // Step 3: Update profile
    console.log("📝 [BACKEND] Updating profile approval status...");
    await profile.update({
      isApproved: true,
      approvalStatus: "approved",
      approvedBy: req.user.id,
      approvedAt: new Date(),
      rejectionReason: null,
    });
    console.log("✅ [BACKEND] Profile updated successfully");

    // Step 4: Fetch or use existing user
    let user = profile.user;
    if (!user) {
      console.log("📝 [BACKEND] Fetching user by ID:", profile.userId);
      user = await User.findByPk(profile.userId);
    }

    if (!user) {
      console.error("❌ [BACKEND] User not found with ID:", profile.userId);
      return res.status(404).json({
        success: false,
        message: "User not found for tutor profile",
      });
    }

    console.log("✅ [BACKEND] User fetched:", user.id, user.email);
    console.log("📝 [BACKEND] Current user roles:", user.roles);
    console.log("📝 [BACKEND] Current primary role:", user.primaryRole);

    // Step 5: Update user roles
    const currentRoles = Array.isArray(user.roles) ? [...user.roles] : [];
    console.log("📝 [BACKEND] Processing roles array...");

    if (!currentRoles.includes("tutor")) {
      currentRoles.push("tutor");
      console.log("📝 [BACKEND] Added 'tutor' role to array");
    } else {
      console.log("📝 [BACKEND] 'tutor' role already in array");
    }

    user.roles = currentRoles;
    user.isTutorProfileComplete = true;
    user.primaryRole = "tutor";

    console.log("📝 [BACKEND] Saving user with new roles:", user.roles);
    await user.save();
    console.log(
      "✅ [BACKEND] User roles updated successfully:",
      user.roles,
      user.primaryRole,
    );

    // Step 6: Create notification (non-blocking)
    console.log("📝 [BACKEND] Creating notification for user:", user.id);
    try {
      const notification = await createNotification(
        user.id,
        "tutor_approved",
        "Tutor Application Approved! 🎉",
        "Congratulations! Your tutor application has been approved by UniHub. You can now start creating courses and sharing your knowledge with students.",
        "/tutor/my-profile",
        { approvedBy: req.user.id },
      );
      console.log("✅ [BACKEND] Notification created successfully");
    } catch (notifError) {
      console.warn(
        "⚠️ [BACKEND] Failed to send notification:",
        notifError.message,
      );
      // Don't fail the request if notification fails
    }

    // Step 7: Return success response
    console.log("✅ [BACKEND] Returning success response");
    res.status(200).json({
      success: true,
      message: "Tutor application approved successfully",
      data: {
        profile: {
          ...profile.toJSON(),
          user: user.toJSON(),
        },
      },
    });
  } catch (error) {
    console.error("🛑 [BACKEND] Error in approveTutorProfile:", error.message);
    console.error("🛑 [BACKEND] Error stack:", error.stack);
    next(error);
  }
};

/**
 * Reject tutor profile (Admin only)
 */
const rejectTutorProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log("🔴 [BACKEND] Reject TutorProfile Handler Called");
    console.log("🔴 [BACKEND] Profile ID:", id);
    console.log("🔴 [BACKEND] Rejection reason:", reason);
    console.log("🔴 [BACKEND] Admin User ID:", req.user?.id);

    // Step 1: Fetch tutor profile
    const profile = await TutorProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!profile) {
      console.error("❌ [BACKEND] Tutor profile not found with ID:", id);
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    console.log("✅ [BACKEND] Profile found:", profile.id);

    // Step 2: Check if already rejected
    if (profile.approvalStatus === "rejected") {
      console.warn("⚠️ [BACKEND] Profile already rejected");
      return res.status(400).json({
        success: false,
        message: "Tutor profile is already rejected",
      });
    }

    // Step 3: Update profile
    const finalReason = reason || "Application did not meet requirements";
    console.log("📝 [BACKEND] Updating profile with rejection reason...");

    await profile.update({
      isApproved: false,
      approvalStatus: "rejected",
      approvedBy: req.user.id,
      approvedAt: new Date(),
      rejectionReason: finalReason,
    });

    console.log("✅ [BACKEND] Profile updated successfully");

    // Step 4: Fetch or use existing user
    let user = profile.user;
    if (!user) {
      user = await User.findByPk(profile.userId);
    }

    if (user) {
      console.log(
        "📝 [BACKEND] Creating rejection notification for user:",
        user.id,
      );
      try {
        await createNotification(
          user.id,
          "tutor_rejected",
          "Tutor Application Update",
          `Unfortunately, your tutor application has been rejected. Reason: ${finalReason}. Please review our requirements and feel free to reapply in the future.`,
          "/student/become-tutor",
          { rejectionReason: finalReason, rejectedBy: req.user.id },
        );
        console.log("✅ [BACKEND] Rejection notification created");
      } catch (notifError) {
        console.warn(
          "⚠️ [BACKEND] Failed to send rejection notification:",
          notifError.message,
        );
      }
    } else {
      console.warn("⚠️ [BACKEND] User not found for notification");
    }

    console.log("✅ [BACKEND] Returning success response");
    res.status(200).json({
      success: true,
      message: "Tutor application rejected successfully",
      data: { profile },
    });
  } catch (error) {
    console.error("🛑 [BACKEND] Error in rejectTutorProfile:", error.message);
    console.error("🛑 [BACKEND] Error stack:", error.stack);
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
  getPendingBankTransfers,
  getAllTutorProfiles,
  getTutorProfileDetails,
  approveTutorProfile,
  rejectTutorProfile,
};
