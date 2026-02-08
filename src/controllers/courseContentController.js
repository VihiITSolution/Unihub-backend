const { CourseContent } = require("../models");
const youtubeUploader = require("../config/youtube");
const path = require("path");
const fs = require("fs");

/**
 * Add content to a course (video lesson or PDF)
 * Videos are uploaded to YouTube (unlisted) if configured, otherwise stored locally
 */
const addCourseContent = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, type, duration, order } = req.body;
    let url;

    // If video file is uploaded
    if (req.file && type === "video") {
      // Try to upload to YouTube if configured
      if (youtubeUploader.initialized) {
        try {
          console.log("Uploading video to YouTube...");
          console.log("File path:", req.file.path);
          url = await youtubeUploader.uploadVideo(
            req.file.path,
            title,
            `Course content for course ID: ${courseId}`,
          );
          console.log("Video uploaded to YouTube:", url);
          // Note: The uploadVideo function already deletes the local file
        } catch (error) {
          console.error(
            "YouTube upload failed:",
            error.message,
          );
          // Fallback to local file URL if YouTube fails
          url = `/uploads/videos/${path.basename(req.file.path)}`;
          console.log("Using local file URL:", url);
        }
      } else {
        // Use local file URL if YouTube is not configured
        url = `/uploads/videos/${path.basename(req.file.path)}`;
        console.log("YouTube not configured, using local file:", url);
      }
    } else if (req.body.url) {
      // Use provided URL (for PDFs or if video URL is manually provided)
      url = req.body.url;
    } else {
      return res.status(400).json({
        success: false,
        message: "Video file or URL is required",
      });
    }

    const content = await CourseContent.create({
      courseId,
      title,
      type,
      url,
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

module.exports = {
  addCourseContent,
  getCourseContent,
  updateCourseContent,
  deleteCourseContent,
};
