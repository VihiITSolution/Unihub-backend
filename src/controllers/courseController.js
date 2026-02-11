const { Course, User, Enrollment } = require("../models");
const { Op } = require("sequelize");

/**
 * Create a new course (Tutor only)
 */
const createCourse = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      level,
      price,
      duration,
      videoUrl,
      contentUrl,
    } = req.body;

    // Handle thumbnail from file upload
    const thumbnail = req.file ? req.file.path : null;

    const course = await Course.create({
      tutorId: req.user.id,
      title,
      description,
      category,
      level,
      price,
      duration,
      thumbnail,
      videoUrl,
      contentUrl,
    });

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all courses with filters
 */
const getCourses = async (req, res, next) => {
  try {
    const {
      category,
      level,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const where = { isPublished: true };

    if (category) where.category = category;
    if (level) where.level = level;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: courses } = await Course.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "tutor",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get course by ID
 */
const getCourseById = async (req, res, next) => {
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
            "bio",
            "profileImage",
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

    // Check enrollment if user is logged in
    let isEnrolled = false;
    if (req.user) {
      const enrollment = await Enrollment.findOne({
        where: {
          courseId: id,
          learnerId: req.user.id,
        },
      });
      isEnrolled = !!enrollment;
    }

    const courseData = course.toJSON();
    courseData.isEnrolled = isEnrolled;

    res.status(200).json({
      success: true,
      data: { course: courseData },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update course (Tutor only - own courses)
 */
const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.tutorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this course",
      });
    }

    const {
      title,
      description,
      category,
      level,
      price,
      duration,
      thumbnail,
      videoUrl,
      contentUrl,
      isPublished,
    } = req.body;

    if (title) course.title = title;
    if (description) course.description = description;
    if (category) course.category = category;
    if (level) course.level = level;
    if (price !== undefined) course.price = price;
    if (duration) course.duration = duration;
    // Handle new thumbnail upload from Cloudinary
    if (req.file) course.thumbnail = req.file.path;
    if (videoUrl) course.videoUrl = videoUrl;
    if (contentUrl) course.contentUrl = contentUrl;
    if (isPublished !== undefined) course.isPublished = isPublished;

    await course.save();

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete course (Tutor only - own courses, or Admin)
 */
const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.tutorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this course",
      });
    }

    await course.destroy();

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get courses by tutor (my courses)
 * Includes approval status, rejection reason, and admin details
 */
const getMyCourses = async (req, res, next) => {
  try {
    const courses = await Course.findAll({
      where: { tutorId: req.user.id },
      include: [
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit course for review (Tutor only)
 * Changes course status from 'draft' to 'pending'
 */
const submitForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.tutorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit this course",
      });
    }

    // Only allow submitting draft or rejected courses
    if (
      course.approvalStatus !== "draft" &&
      course.approvalStatus !== "rejected"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit course with status: ${course.approvalStatus}`,
      });
    }

    course.approvalStatus = "pending";
    course.submittedForReviewAt = new Date();
    course.rejectionReason = null; // Clear previous rejection reason

    await course.save();

    res.status(200).json({
      success: true,
      message: "Course submitted for review successfully",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getMyCourses,
  submitForReview,
};
