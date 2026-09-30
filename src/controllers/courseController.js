const {
  sequelize,
  Course,
  User,
  Enrollment,
  Payment,
  CourseContent,
  CourseNotifyRequest,
  LiveSession,
  Category,
  Department,
  Review,
} = require("../models");
const { Op } = require("sequelize");
const { notifyActiveAdmins } = require("./notificationController");
const { parseCourseDuration } = require("../utils/courseDuration");

/**
 * Create a new course (Tutor only)
 */
const createCourse = async (req, res, next) => {
  try {
    const {
      title,
      description,
      shortDescription,
      aboutCourse,
      category,
      facultyId,
      departmentId,
      year,
      level,
      price,
      duration,
      durationMinutes,
      videoUrl,
      contentUrl,
    } = req.body;

    // Handle thumbnail from file upload
    const thumbnail = req.file ? req.file.path : null;
    const parsedDuration = parseCourseDuration(duration, durationMinutes);
    if (parsedDuration === null) {
      return res.status(400).json({ success: false, message: "Enter a duration of at least one minute, with minutes between 0 and 59." });
    }

    // Use category as the foreign key
    let finalCategory = category;
    if (!finalCategory && category) {
      // Try to find category by name for backward compatibility
      const categoryRecord = await Category.findOne({
        where: { name: category },
      });
      finalCategory = categoryRecord?.id;
    }

    const course = await Course.create({
      tutorId: req.user.id,
      title,
      description,
      shortDescription: shortDescription || null,
      aboutCourse: aboutCourse || null,
      category: finalCategory || null,
      facultyId: facultyId ? parseInt(facultyId) : null,
      departmentId: departmentId ? parseInt(departmentId) : null,
      year: year ? parseInt(year) : null,
      level,
      price,
      duration: parsedDuration?.hours ?? null,
      durationMinutes: parsedDuration?.minutes ?? 0,
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
      facultyId,
      departmentId,
      year,
      minPrice,
      maxPrice,
      search,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    const where = { isPublished: true };

    // Support both old and new fields for backward compatibility
    if (category) where.category = category;
    if (level) where.level = level;
    if (facultyId) where.facultyId = facultyId;
    if (departmentId) where.departmentId = departmentId;
    if (year) where.year = year;

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

    const SORT_OPTIONS = {
      popular: [["enrollmentCount", "DESC"]],
      latest: [["createdAt", "DESC"]],
      price_low: [["price", "ASC"]],
      price_high: [["price", "DESC"]],
    };
    const order = SORT_OPTIONS[sortBy] || [["createdAt", "DESC"]];

    const { count, rows: courses } = await Course.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "tutor",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
        },
        {
          model: require("../models/Faculty"),
          as: "faculty",
          attributes: ["id", "name", "icon", "description"],
          required: false,
        },
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "slug"],
          required: false,
        },
        {
          model: require("../models").Category,
          as: "categoryObj",
          attributes: ["id", "name", "slug", "description", "icon"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order,
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
        {
          model: require("../models/Faculty"),
          as: "faculty",
          attributes: ["id", "name", "icon", "description"],
          required: false,
        },
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "slug"],
          required: false,
        },
        {
          model: require("../models").Category,
          as: "categoryObj",
          attributes: ["id", "name", "slug", "description", "icon"],
          required: false,
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

    // Fetch reviews for this course
    const Review = require("../models/Review");
    const reviews = await Review.findAll({
      where: { courseId: id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "profileImage"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    const courseData = course.toJSON();
    courseData.isEnrolled = isEnrolled;
    courseData.reviews = reviews;

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
      facultyId,
      departmentId,
      year,
      price,
      duration,
      durationMinutes,
      thumbnail,
      videoUrl,
      contentUrl,
      isPublished,
    } = req.body;

    if (title) course.title = title;
    if (description) course.description = description;
    if (category) course.category = category;
    if (level) course.level = level;
    if (facultyId !== undefined) {
      course.facultyId = facultyId && facultyId !== "" ? parseInt(facultyId) : null;
    }
    if (departmentId !== undefined) {
      course.departmentId = departmentId && departmentId !== "" ? parseInt(departmentId) : null;
    }
    if (year !== undefined) {
      course.year = year && year !== "" ? parseInt(year) : null;
    }
    if (price !== undefined) course.price = price;
    const parsedDuration = parseCourseDuration(duration, durationMinutes, course);
    if (parsedDuration === null) {
      return res.status(400).json({ success: false, message: "Enter a duration of at least one minute, with minutes between 0 and 59." });
    }
    if (parsedDuration) {
      course.duration = parsedDuration.hours;
      course.durationMinutes = parsedDuration.minutes;
    }
    // Handle new thumbnail upload from Cloudinary
    if (req.file) course.thumbnail = req.file.path;
    if (videoUrl) course.videoUrl = videoUrl;
    if (contentUrl) course.contentUrl = contentUrl;
    if (isPublished !== undefined) course.isPublished = isPublished;

    await course.save();

    // Reload course with associations to return complete data
    const updatedCourse = await Course.findByPk(id, {
      include: [
        {
          model: User,
          as: "tutor",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
        },
        {
          model: require("../models/Faculty"),
          as: "faculty",
          attributes: ["id", "name", "icon", "description"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: { course: updatedCourse },
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

    const isAdmin =
      req.user.role === "admin" ||
      req.user.primaryRole === "admin" ||
      (Array.isArray(req.user.roles) && req.user.roles.includes("admin"));

    if (course.tutorId !== req.user.id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this course",
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const enrollments = await Enrollment.findAll({
        attributes: ["id"],
        where: { courseId: course.id },
        transaction,
      });
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id);

      // Preserve payment history while removing the enrolment it previously
      // referenced. A course can therefore be fully removed without losing
      // financial records.
      if (enrollmentIds.length > 0) {
        await Payment.update(
          { enrollmentId: null },
          { where: { enrollmentId: enrollmentIds }, transaction },
        );
        await Enrollment.destroy({ where: { courseId: course.id }, transaction });
      }

      const cleanupTasks = [
        CourseContent.destroy({ where: { courseId: course.id }, transaction }),
        Review.destroy({ where: { courseId: course.id }, transaction }),
        // Sessions are historical scheduling records. Retain them but unlink
        // them from the deleted course.
        LiveSession.update(
          { courseId: null },
          { where: { courseId: course.id }, transaction },
        ),
      ];

      const [notifyTable] = await sequelize.query(
        `SELECT 1
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'course_notify_requests'
         LIMIT 1`,
        { transaction },
      );
      if (notifyTable.length > 0) {
        cleanupTasks.push(
          CourseNotifyRequest.destroy({
            where: { courseId: course.id },
            transaction,
          }),
        );
      }

      await Promise.all(cleanupTasks);

      await course.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

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
        {
          model: require("../models/Faculty"),
          as: "faculty",
          attributes: ["id", "name", "icon", "description"],
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

    notifyActiveAdmins(
      "Course awaiting review",
      `“${course.title}” has been submitted for course moderation.`,
      "/courses/pending",
      { courseId: course.id, tutorId: course.tutorId },
    ).catch((notificationError) => console.error("Failed to notify admins about course review:", notificationError.message));

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
