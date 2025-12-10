const { Enrollment, Course, User } = require('../models');

/**
 * Enroll in a course
 */
const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const learnerId = req.user.id;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!course.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'Course is not available for enrollment'
      });
    }

    const existingEnrollment = await Enrollment.findOne({
      where: { learnerId, courseId }
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    const enrollment = await Enrollment.create({
      learnerId,
      courseId,
      status: 'enrolled'
    });

    course.enrollmentCount += 1;
    await course.save();

    res.status(201).json({
      success: true,
      message: 'Enrolled successfully',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user enrollments
 */
const getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { learnerId: req.user.id },
      include: [{
        model: Course,
        as: 'course',
        include: [{
          model: User,
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName', 'profileImage']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: { enrollments }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update enrollment progress
 */
const updateProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progress, status } = req.body;

    const enrollment = await Enrollment.findByPk(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    if (enrollment.learnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this enrollment'
      });
    }

    if (progress !== undefined) enrollment.progress = progress;
    if (status) enrollment.status = status;
    
    if (status === 'completed') {
      enrollment.completedAt = new Date();
    }

    await enrollment.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel enrollment
 */
const cancelEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findByPk(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    if (enrollment.learnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this enrollment'
      });
    }

    enrollment.status = 'cancelled';
    await enrollment.save();

    const course = await Course.findByPk(enrollment.courseId);
    if (course && course.enrollmentCount > 0) {
      course.enrollmentCount -= 1;
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  updateProgress,
  cancelEnrollment
};
