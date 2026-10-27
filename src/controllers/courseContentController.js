const {
  CourseContent,
  Enrollment,
  Course,
  YouTubeRightsDeclaration,
} = require("../models");
const youtubeUploader = require("../config/youtube");
const { recordQualifyingVideoActivity } = require("../services/affiliate.service");
const { syncCourseDuration } = require("../services/courseDuration.service");
const { storeSupportLink, readSupportLink, presentCourseContent } = require("../services/courseSupportMaterial.service");
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

// Support materials are opened in the learner's browser, so accept only
// ordinary public web URLs. This blocks javascript:, data:, and local paths.
const normalizePublicResourceUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 470) {
    return null;
  }
  return url.toString();
};

const sanitizeContentForClient = (content) => {
  const raw = presentCourseContent(content);
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

const isAdminUser = (user = {}) => {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.includes("admin") || user.primaryRole === "admin";
};

const getManagedContent = async (contentId, user) => {
  const content = await CourseContent.findByPk(contentId);
  if (!content) return { status: 404, message: "Content not found" };

  const course = await Course.findByPk(content.courseId);
  if (!course) return { status: 404, message: "Course not found" };

  if (!isAdminUser(user) && Number(course.tutorId) !== Number(user.id)) {
    return {
      status: 403,
      message: "You can only manage content in your own courses.",
    };
  }

  return { content, course };
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
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
    if (!["video", "pdf", "link"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be 'video', 'pdf', or 'link'",
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
    let storedType = type;
    let youtubeVideoId = null;
    let youtubeRightsDeclarationId = null;
    let youtubeRightsConfirmedAt = null;

    if (type === "link") {
      const publicUrl = normalizePublicResourceUrl(req.body.url);
      if (!publicUrl) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid public http(s) support-material link.",
        });
      }
      url = storeSupportLink(publicUrl);
      storedType = "pdf";
    } else if (type === "video" && req.file) {
      // Staff may upload a tutor's supplied material while moderating the course.
      // A tutor declaration remains required for tutor-initiated uploads and
      // externally linked YouTube videos, but must not block an admin upload.
      if (!isAdmin) {
        const declaration = await YouTubeRightsDeclaration.findOne({
          where: { userId: course.tutorId },
        });
        if (!declaration) {
          return res.status(428).json({
            success: false,
            code: "YOUTUBE_RIGHTS_DECLARATION_REQUIRED",
            message: "Sign the one-time rights declaration before your first video upload or YouTube link.",
          });
        }
      }
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
      type: storedType,
      url,
      youtubeVideoId,
      youtubeRightsDeclarationId,
      youtubeRightsConfirmedAt,
      duration: duration || null,
      order: order || 0,
      isPreview: isPreview === "true" || isPreview === true ? true : false,
    });
    await recordQualifyingVideoActivity(course, content);
    await syncCourseDuration(course.id);

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

    const managed = await getManagedContent(contentId, req.user);
    if (!managed.content) {
      return res.status(managed.status).json({
        success: false,
        message: managed.message,
      });
    }

    const { content, course } = managed;

    if (title !== undefined) {
      const normalizedTitle = String(title).trim();
      if (!normalizedTitle || normalizedTitle.length > 255) {
        return res.status(400).json({
          success: false,
          message: "Title is required and must not exceed 255 characters.",
        });
      }
      content.title = normalizedTitle;
    }

    if (duration !== undefined) {
      if (duration === null || duration === "") {
        content.duration = null;
      } else {
        const normalizedDuration = Number(duration);
        if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0) {
          return res.status(400).json({
            success: false,
            message: "Duration must be a positive whole number of minutes.",
          });
        }
        content.duration = normalizedDuration;
      }
    }

    if (order !== undefined) {
      const normalizedOrder = Number(order);
      if (!Number.isInteger(normalizedOrder) || normalizedOrder < 0) {
        return res.status(400).json({
          success: false,
          message: "Display order must be zero or a positive whole number.",
        });
      }
      content.order = normalizedOrder;
    }

    if (url !== undefined) {
      if (readSupportLink(content.url)) {
        const normalizedUrl = normalizePublicResourceUrl(url);
        if (!normalizedUrl) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid public http(s) support-material link.",
          });
        }
        content.url = storeSupportLink(normalizedUrl);
      } else {
        if (content.type !== "video") {
          return res.status(400).json({
            success: false,
            message: "A PDF file cannot be replaced from the material details editor.",
          });
        }

        const videoId = extractYouTubeVideoId(String(url).trim());
        if (!videoId) {
          return res.status(400).json({
            success: false,
            message: "Only valid YouTube links can be used for video materials.",
          });
        }

        const rightsConfirmed = parseBoolean(req.body.youtubeRightsConfirmed);
        if (rightsConfirmed !== true) {
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
            message: "Sign the YouTube rights declaration before changing an externally hosted video.",
          });
        }

        content.url = buildPrivacyEmbedUrl(videoId);
        content.youtubeVideoId = videoId;
        content.youtubeRightsDeclarationId = declaration.id;
        content.youtubeRightsConfirmedAt = new Date();
      }
    }

    if (isPublished !== undefined) {
      const normalizedPublished = parseBoolean(isPublished);
      if (normalizedPublished === null) {
        return res.status(400).json({
          success: false,
          message: "Published must be true or false.",
        });
      }
      content.isPublished = normalizedPublished;
    }

    if (isPreview !== undefined) {
      const normalizedPreview = parseBoolean(isPreview);
      if (normalizedPreview === null) {
        return res.status(400).json({
          success: false,
          message: "Preview must be true or false.",
        });
      }
      content.isPreview = normalizedPreview;
    }

    await content.save();
    await recordQualifyingVideoActivity(course, content);
    await syncCourseDuration(course.id);

    res.status(200).json({
      success: true,
      message: "Content updated successfully",
      data: { content: sanitizeContentForClient(content) },
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

    const managed = await getManagedContent(contentId, req.user);
    if (!managed.content) {
      return res.status(managed.status).json({
        success: false,
        message: managed.message,
      });
    }

    const { content, course } = managed;

    await content.destroy();
    await syncCourseDuration(course.id);

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
