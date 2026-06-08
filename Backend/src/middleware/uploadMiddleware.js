const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const uploadDirectory = path.join(__dirname, "..", "..", "uploads", "messages");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed"
];

const sanitizeOriginalFilename = (originalName = "attachment") => {
  const baseName = path.basename(originalName);
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const compactName = sanitizedName.replace(/_+/g, "_").slice(0, 120);

  return compactName || "attachment";
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeOriginalFilename(
      file.originalname
    )}`;

    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("This file type is not allowed."), false);
    return;
  }

  cb(null, true);
};

const uploadMessageAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE
  }
});

module.exports = {
  MAX_ATTACHMENT_SIZE,
  uploadMessageAttachment
};
