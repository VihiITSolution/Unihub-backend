const { CourseContent, Enrollment } = require("../models");
const youtubeUploader = require("../config/youtube");
const path = require("path");

/**
 * Add content to a course (video lesson or PDF)
 * Videos are automatically uploaded to YouTube as unlisted
 */
const addCourseContent = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, type, duration, order } = req.body;
    let url;
    let youtubeVideoId = null;

    if (type === "video" && req.file) {
      // Upload video to YouTube as unlisted
      const videoPath = req.file.path;
      const videoTitle = `${title} - Course ${courseId}`;
      const videoDescription = `Course lesson: ${title}`;

      try {
        const youtubeUrl = await youtubeUploader.uploadVideo(
          videoPath,
          videoTitle,
          videoDescription
        );

        // Extract video ID from YouTube URL
        if (youtubeUrl.includes("youtube.com/watch?v=")) {
          youtubeVideoId = youtubeUrl.split("v=")[1]?.split("&")[0];
        } else if (youtubeUrl.includes("youtu.be/")) {
          youtubeVideoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
        }

        url = youtubeUrl;
        console.log("Video uploaded to YouTube:", youtubeUrl);
      } catch (uploadError) {
        console.error("YouTube upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload video to YouTube. Please try again.",
        });
      }
    } else if (req.body.url) {
      // Use provided URL (for PDFs or if video URL is manually provided)
      url = req.body.url;
    } else if (req.file) {
      // For PDFs or other files
      url = req.file.path;
    } else {
      return res.status(400).json({
        success: false,
        message: "File or URL is required",
      });
    }

    const content = await CourseContent.create({
      courseId,
      title,
      type,
      url,
      youtubeVideoId,
      duration: duration || null,
      order: order || 0,
    });

    res.status(201).json({
      success: true,
      message: "Course content added successfully",
      data: { content },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all content for a course
 */
const getCourseContent = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const contents = await CourseContent.findAll({
      where: { courseId },
      order: [
        ["order", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    res.status(200).json({
      success: true,
      data: { contents },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update course content
 */
const updateCourseContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { title, url, duration, order, isPublished } = req.body;

    const content = await CourseContent.findByPk(contentId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    if (title) content.title = title;
    if (url) content.url = url;
    if (duration !== undefined) content.duration = duration;
    if (order !== undefined) content.order = order;
    if (isPublished !== undefined) content.isPublished = isPublished;

    await content.save();

    res.status(200).json({
      success: true,
      message: "Content updated successfully",
      data: { content },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete course content
 */
const deleteCourseContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;

    const content = await CourseContent.findByPk(contentId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    await content.destroy();

    res.status(200).json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific course content with enrollment validation
 * Only enrolled students or course tutor can access
 */
const getContentById = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    const content = await CourseContent.findByPk(contentId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    // Check if user is enrolled in the course or is the tutor/admin
    const enrollment = await Enrollment.findOne({
      where: {
        learnerId: userId,
        courseId: content.courseId,
      },
    });

    const isEnrolled = enrollment !== null;
    const isAdmin = userRoles.includes("admin");
    const isTutor = userRoles.includes("tutor");

    if (!isEnrolled && !isAdmin && !isTutor) {
      return res.status(403).json({
        success: false,
        message: "You must be enrolled in this course to access this content",
      });
    }

    res.status(200).json({
      success: true,
      data: { content },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addCourseContent,
  getCourseContent,
  updateCourseContent,
  deleteCourseContent,
  getContentById,
};
