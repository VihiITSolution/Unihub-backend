const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_EXTENSIONS = /jpe?g|png|gif|webp/;
const DOCUMENT_EXTENSIONS = /pdf|docx?|pptx?|xlsx?/;
const VIDEO_EXTENSIONS = /mp4|mov|avi|webm/;

const classifyFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (IMAGE_EXTENSIONS.test(ext) && file.mimetype.startsWith("image/")) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.test(ext) && file.mimetype.startsWith("video/")) {
    return "video";
  }
  if (DOCUMENT_EXTENSIONS.test(ext)) {
    return "document";
  }
  return null;
};

// Multipart uploads stream straight to Cloudinary, so a file's size isn't
// known until the upload finishes - multer can't enforce a per-type ceiling
// up front. We rely on a single, chat-appropriate max (well below the 5GB
// course-video config) rather than buffering uploads just to pre-check size.
const chatAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const fileType = classifyFile(file);
    return {
      folder: "unihub/chat-attachments",
      resource_type: fileType === "document" ? "raw" : "auto",
      public_id: `chat-${Date.now()}-${file.originalname
        .split(".")[0]
        .replace(/[^a-zA-Z0-9_-]/g, "")}`,
    };
  },
});

const chatAttachmentFilter = (req, file, cb) => {
  const fileType = classifyFile(file);
  if (!fileType) {
    return cb(
      new Error(
        "Unsupported file type. Allowed: images, documents (pdf/doc/ppt/xls), and video.",
      ),
    );
  }
  file.chatFileType = fileType;
  cb(null, true);
};

const uploadChatAttachments = multer({
  storage: chatAttachmentStorage,
  fileFilter: chatAttachmentFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
  },
}).array("attachments", 5);

module.exports = { uploadChatAttachments, classifyFile };
