const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { CourseContent, Course, YouTubeRightsDeclaration } = require("../models");
const youtubeUploader = require("../config/youtube");
const { recordQualifyingVideoActivity } = require("../services/affiliate.service");
const { syncCourseDuration } = require("../services/courseDuration.service");

const uploadsDir = path.join(__dirname, "../../uploads");
const chunksBaseDir = path.join(uploadsDir, "chunks");
const videosDir = path.join(uploadsDir, "videos");

[chunksBaseDir, videosDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const buildPrivacyEmbedUrl = (videoId) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0`;

// Each chunk is written to uploads/chunks/{uploadId}/chunk-{index}
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(chunksBaseDir, req.body.uploadId || "unknown");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `chunk-${parseInt(req.body.chunkIndex, 10)}`);
  },
});

const receiveChunkMiddleware = multer({
  storage: chunkStorage,
  limits: { fileSize: 800 * 1024 }, // 800 KB — frontend sends 512 KB chunks; header overhead keeps total under 1 MB nginx default
}).single("chunk");

/** POST /api/courses/:courseId/content/chunks */
const receiveChunk = (req, res, next) => {
  receiveChunkMiddleware(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "Chunk too large. Reduce CHUNK_SIZE in the frontend."
        : err.message;
      return res.status(400).json({ success: false, message: msg });
    }
    if (!req.file)
      return res.status(400).json({ success: false, message: "No chunk received." });
    res.json({ success: true });
  });
};

/** POST /api/courses/:courseId/content/chunks/complete */
const completeChunkedUpload = async (req, res, next) => {
  const chunkDir = path.join(chunksBaseDir, req.body.uploadId || "");

  const cleanup = () => {
    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
  };

  try {
    const { courseId } = req.params;
    const { uploadId, totalChunks, fileName, title, type, duration, order, isPreview } = req.body;

    if (!uploadId || !totalChunks || !fileName || !title || !type) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    const isAdmin = req.user.roles?.includes("admin") || req.user.primaryRole === "admin";
    if (!isAdmin && Number(course.tutorId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only add content to your own courses." });
    }
    if (type !== "video") {
      return res.status(400).json({ success: false, message: "Chunked uploads only support videos." });
    }
    const declaration = await YouTubeRightsDeclaration.findOne({ where: { userId: course.tutorId } });
    if (!declaration) {
      return res.status(428).json({
        success: false,
        code: "YOUTUBE_RIGHTS_DECLARATION_REQUIRED",
        message: "Sign the one-time rights declaration before your first video upload or YouTube link.",
      });
    }

    const n = parseInt(totalChunks, 10);
    const ext = path.extname(fileName) || ".mp4";
    const assembledFilename = `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const assembledPath = path.join(videosDir, assembledFilename);

    // Concatenate all chunks in order
    const out = fs.createWriteStream(assembledPath);
    for (let i = 0; i < n; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) {
        cleanup();
        return res.status(400).json({ success: false, message: `Missing chunk ${i}. Please retry.` });
      }
      out.write(fs.readFileSync(chunkPath));
    }
    await new Promise((resolve, reject) => {
      out.end();
      out.on("finish", resolve);
      out.on("error", reject);
    });

    cleanup();

    // Upload assembled file to YouTube
    let url;
    let youtubeVideoId = null;

    try {
      const ytUrl = await youtubeUploader.uploadVideo(
        assembledPath,
        `${title} - Course ${courseId}`,
        `Course lesson: ${title}`,
      );

      if (ytUrl.includes("youtube.com/watch?v=")) {
        youtubeVideoId = ytUrl.split("v=")[1]?.split("&")[0];
      } else if (ytUrl.includes("youtu.be/")) {
        youtubeVideoId = ytUrl.split("youtu.be/")[1]?.split("?")[0];
      }

      url = youtubeVideoId ? buildPrivacyEmbedUrl(youtubeVideoId) : ytUrl;
    } catch (ytError) {
      console.error("YouTube upload failed:", ytError.message);
      try { fs.unlinkSync(assembledPath); } catch {}
      return res.status(500).json({
        success: false,
        message: ytError.message || "Failed to upload video to YouTube.",
      });
    }

    const content = await CourseContent.create({
      courseId,
      title,
      type,
      url,
      youtubeVideoId,
      duration: duration ? parseInt(duration, 10) : null,
      order: order ? parseInt(order, 10) : 0,
      isPreview: isPreview === "true" || isPreview === true,
    });
    await recordQualifyingVideoActivity(course, content);
    await syncCourseDuration(course.id);

    res.status(201).json({ success: true, message: "Course content added successfully", data: { content } });
  } catch (error) {
    cleanup();
    next(error);
  }
};

module.exports = { receiveChunk, completeChunkedUpload };
