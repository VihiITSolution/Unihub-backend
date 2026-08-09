const {
  CourseContent,
  Enrollment,
  Course,
  YouTubeRightsDeclaration,
} = require("../models");
const youtubeUploader = require("../config/youtube");
const path = require("path");
const fs = require("fs");

const extractYouTubeVideoId = (url = "") => {
  if (!url) return null;

  if (url.includes("youtube.com/watch?v=")) {
    return url.split("v=")[1]?.split("&")[0] || null;
  }

  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1]?.split("?")[0] || null;
  }

  if (url.includes("youtube.com/embed/") || url.includes("youtube-nocookie.com/embed/")) {
    return url.split("/embed/")[1]?.split("?")[0] || null;
  }

  return null;
};

const buildPrivacyEmbedUrl = (videoId) => {
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0`;
};

const sanitizeContentForClient = (content) => {
  const raw = content?.toJSON ? content.toJSON() : content;
  if (!raw) return raw;

  if (raw.type === "video") {
    const videoId = raw.youtubeVideoId || extractYouTubeVideoId(raw.url);
    const embedUrl = buildPrivacyEmbedUrl(videoId);

    return {
      ...raw,
      youtubeVideoId: videoId || raw.youtubeVideoId || null,
      url: embedUrl || raw.url,
    };
  }

  return raw;
};

/**
 * Add content to a course (video lesson or PDF)
 * Videos are automatically uploaded to YouTube as unlisted
 */
const addCourseContent = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, type, duration, order, isPreview } = req.body || {};

    // Validate required fields
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: "Title and type are required",
      });
    }

    // Validate type value
    if (type !== "video" && type !== "pdf") {
      return res.status(400).json({
        success: false,
        message: "Type must be either 'video' or 'pdf'",
      });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isAdmin = userRoles.includes("admin") || req.user.primaryRole === "admin";
    if (!isAdmin && Number(course.tutorId) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You can only add content to your own courses.",
      });
    }

    let url;
    let youtubeVideoId = null;
    let youtubeRightsDeclarationId = null;
    let youtubeRightsConfirmedAt = null;

    if (type === "video" && req.file) {
      // Upload video to YouTube as unlisted
      const videoPath = req.file.path;
      const videoTitle = `${title} - Course ${courseId}`;
      const videoDescription = `Course lesson: ${title}`;

      try {
        const youtubeUrl = await youtubeUploader.uploadVideo(
          videoPath,
          videoTitle,
          videoDescription,
        );

        // Extract video ID from YouTube URL
        if (youtubeUrl.includes("youtube.com/watch?v=")) {
          youtubeVideoId = youtubeUrl.split("v=")[1]?.split("&")[0];
        } else if (youtubeUrl.includes("youtu.be/")) {
          youtubeVideoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
        }

        url = buildPrivacyEmbedUrl(youtubeVideoId) || youtubeUrl;
        console.log("Video uploaded to YouTube:", youtubeUrl);
      } catch (uploadError) {
        console.error("YouTube upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message:
            uploadError.message ||
            "Failed to upload video to YouTube. Please try again.",
        });
      }
    } else if (req.body.url) {
      // Use provided URL (for PDFs or if video URL is manually provided).
      // Linked videos must be an actual YouTube link — the tutor is responsible
      // for owning/having rights to whatever they link (enforced client-side too).
      if (type === "video") {
        const videoId = extractYouTubeVideoId(req.body.url);
        if (!videoId) {
          return res.status(400).json({
            success: false,
            message: "Only YouTube links (youtube.com or youtu.be) are supported for linked videos.",
          });
        }

        const rightsConfirmed =
          req.body.youtubeRightsConfirmed === true ||
          req.body.youtubeRightsConfirmed === "true";
        if (!rightsConfirmed) {
          return res.status(400).json({
            success: false,
            message: "Confirm that this YouTube link is covered by the tutor's signed rights declaration.",
          });
        }

        const declaration = await YouTubeRightsDeclaration.findOne({
          where: { userId: course.tutorId },
        });
        if (!declaration) {
          return res.status(428).json({
            success: false,
            code: "YOUTUBE_RIGHTS_DECLARATION_REQUIRED",
            message: "Sign the YouTube rights declaration before adding an externally hosted video.",
          });
        }

        youtubeVideoId = videoId;
        url = buildPrivacyEmbedUrl(videoId);
        youtubeRightsDeclarationId = declaration.id;
        youtubeRightsConfirmedAt = new Date();
      } else {
        url = req.body.url;
      }
    } else if (req.file) {
      // For PDFs - Cloudinary URL is in req.file.path
      url = req.file.path;
      console.log("PDF uploaded to Cloudinary:", url);
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
      youtubeRightsDeclarationId,
      youtubeRightsConfirmedAt,
      duration: duration || null,
      order: order || 0,
      isPreview: isPreview === "true" || isPreview === true ? true : false,
    });

    res.status(201).json({
      success: true,
      message: "Course content added successfully",
      data: { content: sanitizeContentForClient(content) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all content for a course.
 * Publicly accessible for browsing (title/type/order/isPreview), but the
 * actual playable url is only included for preview lessons unless the
 * requester is enrolled in the course, owns it (tutor), or is an admin.
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

    let hasFullAccess = false;
    if (req.user) {
      const userRoles = req.user.roles || [];
      if (userRoles.includes("admin")) {
        hasFullAccess = true;
      } else {
        const course = await Course.findByPk(courseId);
        if (course && course.tutorId === req.user.id) {
          hasFullAccess = true;
        } else {
          const enrollment = await Enrollment.findOne({
            where: { learnerId: req.user.id, courseId },
          });
          hasFullAccess = enrollment !== null;
        }
      }
    }

    // Filter out any invalid content without type
    const validContents = contents
      .filter((content) => content.type)
      .map((content) => {
        const sanitized = sanitizeContentForClient(content);
        if (hasFullAccess || sanitized.isPreview) {
          return sanitized;
        }
        // Lock non-preview content for guests/non-enrolled users:
        // strip the playable url so it can't be retrieved via the API
        // before enrolling.
        return {
          ...sanitized,
          url: null,
          youtubeVideoId: null,
          locked: true,
        };
      });

    res.status(200).json({
      success: true,
      data: { contents: validContents },
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
    const { title, url, duration, order, isPublished, isPreview } = req.body;

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
    if (isPreview !== undefined)
      content.isPreview =
        isPreview === "true" || isPreview === true ? true : false;

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
    const course = await Course.findByPk(content.courseId);
    const isOwningTutor = course !== null && course.tutorId === userId;

    if (!isEnrolled && !isAdmin && !isOwningTutor) {
      return res.status(403).json({
        success: false,
        message: "You must be enrolled in this course to access this content",
      });
    }

    res.status(200).json({
      success: true,
      data: { content: sanitizeContentForClient(content) },
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
