const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const messageUploadDirectory = path.join(uploadsRoot, "messages");
const avatarUploadDirectory = path.join(uploadsRoot, "avatars");

[messageUploadDirectory, avatarUploadDirectory].forEach((directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
});

const allowedAttachmentMimeTypes = [
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

const allowedAvatarMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const sanitizeOriginalFilename = (originalName = "file") => {
  const baseName = path.basename(originalName);
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const compactName = sanitizedName.replace(/_+/g, "_").slice(0, 120);

  return compactName || "file";
};

const createStorage = (destination) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeOriginalFilename(
        file.originalname
      )}`;

      cb(null, uniqueName);
    }
  });

const createFileFilter = (allowedMimeTypes, errorMessage) =>
  (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error(errorMessage), false);
      return;
    }

    cb(null, true);
  };

const uploadMessageAttachment = multer({
  storage: createStorage(messageUploadDirectory),
  fileFilter: createFileFilter(
    allowedAttachmentMimeTypes,
    "This file type is not allowed."
  ),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE
  }
});

const uploadProfileAvatar = multer({
  storage: createStorage(avatarUploadDirectory),
  fileFilter: createFileFilter(
    allowedAvatarMimeTypes,
    "Avatar must be a JPEG, PNG, WebP, or GIF image."
  ),
  limits: {
    fileSize: MAX_AVATAR_SIZE
  }
});

module.exports = {
  MAX_ATTACHMENT_SIZE,
  MAX_AVATAR_SIZE,
  uploadMessageAttachment,
  uploadProfileAvatar
};
