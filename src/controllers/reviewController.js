const { Review, Course, User, Enrollment } = require("../models");
const { Op } = require("sequelize");

/**
 * Add or update a review for a course
 */
const addReview = async (req, res, next) => {
  try {
    const { courseId, rating, comment } = req.body;
    const userId = req.user.id;

    // Check if user is enrolled in the course
    const enrollment = await Enrollment.findOne({
      where: { learnerId: userId, courseId },
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: "You must be enrolled in this course to leave a review",
      });
    }

    // Check if review already exists
    let review = await Review.findOne({
      where: { userId, courseId },
    });

    if (review) {
      // Update existing review
      review.rating = rating;
      review.comment = comment;
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        userId,
        courseId,
        rating,
        comment,
      });
    }

    // Update course rating and review count
    await updateCourseRating(courseId);

    res.status(200).json({
      success: true,
      message:
        review.createdAt === review.updatedAt
          ? "Review added successfully"
          : "Review updated successfully",
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reviews for a course
 */
const getCourseReviews = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { courseId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "profileImage"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
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
 * Get user's review for a specific course
 */
const getUserReview = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const review = await Review.findOne({
      where: { userId, courseId },
    });

    res.status(200).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a review
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    const courseId = review.courseId;
    await review.destroy();

    // Update course rating
    await updateCourseRating(courseId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to update course rating
 */
const updateCourseRating = async (courseId) => {
  const reviews = await Review.findAll({
    where: { courseId },
    attributes: ["rating"],
  });

  const course = await Course.findByPk(courseId);
  if (!course) return;

  if (reviews.length === 0) {
    course.rating = 0;
    course.reviewCount = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    course.rating = (totalRating / reviews.length).toFixed(2);
    course.reviewCount = reviews.length;
  }

  await course.save();
};

module.exports = {
  addReview,
  getCourseReviews,
  getUserReview,
  deleteReview,
};
