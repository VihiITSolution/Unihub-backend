const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");
const videosDir = path.join(uploadsDir, "videos");

[uploadsDir, thumbnailsDir, videosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, thumbnailsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "thumbnail-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Storage configuration for videos
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "video-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter for thumbnails (only jpeg/png)
const thumbnailFilter = function (req, file, cb) {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only JPEG and PNG images are allowed for thumbnails!"));
  }
};

// File filter for videos
const videoFilter = function (req, file, cb) {
  const allowedTypes = /mp4|avi|mov|wmv|flv|mkv/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = file.mimetype.startsWith("video/");

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only video files are allowed!"));
  }
};

// Thumbnail upload middleware
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: thumbnailFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
}).single("thumbnail");

// Video upload middleware
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
  },
}).single("video");

// File filter for course content (videos and PDFs)
const courseContentFilter = function (req, file, cb) {
  const allowedVideoTypes = /mp4|avi|mov|wmv|flv|mkv/;
  const allowedPdfType = /pdf/;
  const extname = path.extname(file.originalname).toLowerCase();

  const isVideo =
    allowedVideoTypes.test(extname.slice(1)) &&
    file.mimetype.startsWith("video/");
  const isPdf =
    allowedPdfType.test(extname.slice(1)) &&
    file.mimetype === "application/pdf";

  if (isVideo || isPdf) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        "Only video files (MP4, AVI, MOV, WMV) and PDF documents are allowed!",
      ),
    );
  }
};

// Cloudinary storage for course content (videos and PDFs)
const courseContentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: isPdf ? "unihub/course-pdfs" : "unihub/course-videos",
      resource_type: isPdf ? "raw" : "video",
      allowed_formats: isPdf ? ["pdf"] : ["mp4", "mov", "avi", "wmv"],
      public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    };
  },
});

// Course content upload middleware (videos and PDFs)
const uploadCourseContent = multer({
  storage: courseContentStorage,
  fileFilter: courseContentFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
  },
}).single("video");

module.exports = {
  uploadThumbnail,
  uploadVideo,
  uploadCourseContent,
  thumbnailsDir,
  videosDir,
};
