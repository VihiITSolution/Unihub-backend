const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for thumbnails
const thumbnailStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/thumbnails",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 1280, height: 720, crop: "limit" }],
  },
});

// Storage for videos (optional - if not using YouTube)
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "avi", "wmv"],
  },
});

// Thumbnail upload middleware
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("thumbnail");

// Video upload middleware (fallback if YouTube fails)
const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
}).single("video");

module.exports = {
  cloudinary,
  uploadThumbnail,
  uploadVideo,
};
