const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary storage
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

// Storage for profile images
const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

// Profile image upload middleware
const uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("profileImage");

// Storage for course content PDFs
const pdfStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/course-pdfs",
    resource_type: "raw",
    allowed_formats: ["pdf"],
    public_id: (req, file) =>
      `pdf-${Date.now()}-${file.originalname.split(".")[0]}`,
  },
});

// PDF upload middleware
const uploadPDF = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single("video");

// Storage for support ticket attachments (images or PDFs)
const ticketAttachmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/support-tickets",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
});

// Ticket attachment upload middleware - up to 5 files, 10MB each
const uploadTicketAttachments = multer({
  storage: ticketAttachmentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG, JPG, and PDF files are allowed"));
    }
    cb(null, true);
  },
}).array("attachments", 5);

// Storage for marketplace listing images
const marketplaceImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/marketplace",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 1280, height: 1280, crop: "limit" }],
  },
});

// Marketplace image upload middleware - up to 5 images, 5MB each
const uploadMarketplaceImages = multer({
  storage: marketplaceImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG and JPG images are allowed"));
    }
    cb(null, true);
  },
}).array("images", 5);

// Storage for boarding place images
const boardingImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/boarding",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  },
});

// Boarding image upload middleware - up to 8 images, 5MB each
const uploadBoardingImages = multer({
  storage: boardingImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 8,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG and JPG images are allowed"));
    }
    cb(null, true);
  },
}).array("images", 8);

// Storage for boarding place videos
const boardingVideoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "unihub/boarding-videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "avi", "wmv"],
  },
});

// Boarding video upload middleware - up to 2 videos, 100MB each
const uploadBoardingVideos = multer({
  storage: boardingVideoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed"));
    }
    cb(null, true);
  },
}).array("videos", 2);

module.exports = {
  cloudinary,
  uploadThumbnail,
  uploadVideo,
  uploadProfileImage,
  uploadPDF,
  uploadTicketAttachments,
  uploadMarketplaceImages,
  uploadBoardingImages,
  uploadBoardingVideos,
};
