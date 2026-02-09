const { Enrollment, Course, User, StudentProfile } = require("../models");

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
        message: "Course not found",
      });
    }

    if (!course.isPublished) {
      return res.status(400).json({
        success: false,
        message: "Course is not available for enrollment",
      });
    }

    const existingEnrollment = await Enrollment.findOne({
      where: { learnerId, courseId },
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled in this course",
      });
    }

    const enrollment = await Enrollment.create({
      learnerId,
      courseId,
      status: "enrolled",
    });

    course.enrollmentCount += 1;
    await course.save();

    res.status(201).json({
      success: true,
      message: "Enrolled successfully",
      data: { enrollment },
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
      include: [
        {
          model: Course,
          as: "course",
          include: [
            {
              model: User,
              as: "tutor",
              attributes: ["id", "firstName", "lastName", "profileImage"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: { enrollments },
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
        message: "Enrollment not found",
      });
    }

    if (enrollment.learnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this enrollment",
      });
    }

    if (progress !== undefined) enrollment.progress = progress;
    if (status) enrollment.status = status;

    if (status === "completed") {
      enrollment.completedAt = new Date();
    }

    await enrollment.save();

    res.status(200).json({
      success: true,
      message: "Progress updated successfully",
      data: { enrollment },
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
        message: "Enrollment not found",
      });
    }

    if (enrollment.learnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this enrollment",
      });
    }

    enrollment.status = "cancelled";
    await enrollment.save();

    const course = await Course.findByPk(enrollment.courseId);
    if (course && course.enrollmentCount > 0) {
      course.enrollmentCount -= 1;
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: "Enrollment cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is enrolled in a specific course
 */
const checkEnrollment = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const learnerId = req.user.id;

    const enrollment = await Enrollment.findOne({
      where: { learnerId, courseId },
    });

    res.status(200).json({
      success: true,
      data: {
        isEnrolled: !!enrollment,
        enrollment: enrollment || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all students enrolled in tutor's courses
 */
const getTutorStudents = async (req, res, next) => {
  try {
    const tutorId = req.user.id;

    // Get all courses by this tutor
    const tutorCourses = await Course.findAll({
      where: { tutorId },
      attributes: ["id", "title"],
    });

    if (!tutorCourses || tutorCourses.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          students: [],
          totalStudents: 0,
        },
      });
    }

    const courseIds = tutorCourses.map((course) => course.id);

    // Get all enrollments for these courses with student and course details
    const enrollments = await Enrollment.findAll({
      where: {
        courseId: courseIds,
      },
      include: [
        {
          model: User,
          as: "learner",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
          include: [
            {
              model: StudentProfile,
              as: "studentProfile",
              attributes: ["universityName", "department", "degreeOrCourse"],
              required: false,
            },
          ],
        },
        {
          model: Course,
          as: "course",
          attributes: ["id", "title", "thumbnail"],
        },
      ],
      order: [["enrolledAt", "DESC"]],
    });

    // Format the response
    const students = enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      progress: enrollment.progress,
      completedAt: enrollment.completedAt,
      student: {
        id: enrollment.learner.id,
        firstName: enrollment.learner.firstName,
        lastName: enrollment.learner.lastName,
        email: enrollment.learner.email,
        profileImage: enrollment.learner.profileImage,
        university: enrollment.learner.studentProfile?.universityName || "N/A",
        department: enrollment.learner.studentProfile?.department,
        degree: enrollment.learner.studentProfile?.degreeOrCourse,
      },
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        thumbnail: enrollment.course.thumbnail,
      },
    }));

    res.status(200).json({
      success: true,
      data: {
        students,
        totalStudents: students.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  updateProgress,
  cancelEnrollment,
  checkEnrollment,
  getTutorStudents,
};
