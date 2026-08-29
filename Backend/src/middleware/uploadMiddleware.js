const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { TextDecoder } = require("util");
const multer = require("multer");

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const FILE_SIGNATURE_BYTES = 8192;
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

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip"
};

const createStorage = (destination) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const safeExtension = extensionByMimeType[file.mimetype] || "";
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
      cb(null, uniqueName);
    }
  });

const createFileFilter = (allowedMimeTypes, errorMessage) =>
  (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error(errorMessage);
      error.statusCode = 400;
      cb(error, false);
      return;
    }

    cb(null, true);
  };

const startsWithBytes = (buffer, bytes) => {
  if (!buffer || buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
};

const hasAsciiAt = (buffer, offset, value) =>
  buffer.length >= offset + value.length &&
  buffer.subarray(offset, offset + value.length).toString("ascii") === value;

const isZipSignature = (buffer) =>
  startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
  startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
  startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08]);

const isOleCompoundDocument = (buffer) =>
  startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const isValidUtf8Text = (buffer) => {
  if (!buffer.length || buffer.includes(0x00)) {
    return false;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch (error) {
    return false;
  }
};

const fileSignatureMatchesMimeType = (buffer, mimeType) => {
  switch (mimeType) {
    case "image/jpeg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return hasAsciiAt(buffer, 0, "GIF87a") || hasAsciiAt(buffer, 0, "GIF89a");
    case "image/webp":
      return hasAsciiAt(buffer, 0, "RIFF") && hasAsciiAt(buffer, 8, "WEBP");
    case "video/mp4":
      return hasAsciiAt(buffer, 4, "ftyp") && !hasAsciiAt(buffer, 8, "qt  ");
    case "video/quicktime":
      return hasAsciiAt(buffer, 4, "ftyp") && hasAsciiAt(buffer, 8, "qt  ");
    case "video/webm":
    case "audio/webm":
      return startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mpeg":
      return hasAsciiAt(buffer, 0, "ID3") ||
        (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    case "audio/wav":
      return hasAsciiAt(buffer, 0, "RIFF") && hasAsciiAt(buffer, 8, "WAVE");
    case "audio/ogg":
      return hasAsciiAt(buffer, 0, "OggS");
    case "application/pdf":
      return hasAsciiAt(buffer, 0, "%PDF-");
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.ms-powerpoint":
      return isOleCompoundDocument(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/zip":
    case "application/x-zip-compressed":
      return isZipSignature(buffer);
    case "text/plain":
      return isValidUtf8Text(buffer);
    default:
      return false;
  }
};

const removeUploadedFile = async (file) => {
  if (!file?.path) {
    return;
  }

  try {
    await fsPromises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Failed to clean up uploaded file ${file.path}:`, error.message);
    }
  }
};

const createFileContentValidator = (errorMessage) => async (req, res, next) => {
  if (!req.file) {
    next();
    return;
  }

  try {
    const handle = await fsPromises.open(req.file.path, "r");
    const buffer = Buffer.alloc(FILE_SIGNATURE_BYTES);
    let bytesRead = 0;

    try {
      const readResult = await handle.read(buffer, 0, buffer.length, 0);
      bytesRead = readResult.bytesRead;
    } finally {
      await handle.close();
    }

    const fileHeader = buffer.subarray(0, bytesRead);

    if (!fileSignatureMatchesMimeType(fileHeader, req.file.mimetype)) {
      const rejectedFile = req.file;
      req.file = null;
      await removeUploadedFile(rejectedFile);
      const error = new Error(errorMessage);
      error.statusCode = 400;
      next(error);
      return;
    }

    next();
  } catch (error) {
    const rejectedFile = req.file;
    req.file = null;
    await removeUploadedFile(rejectedFile);
    next(error);
  }
};

const cleanupUncommittedUpload = (req, res, next) => {
  req.uploadCommitted = false;
  let cleanupStarted = false;

  const cleanup = () => {
    if (cleanupStarted || req.uploadCommitted || !req.file) {
      return;
    }

    cleanupStarted = true;
    removeUploadedFile(req.file);
  };

  res.once("finish", cleanup);
  res.once("close", cleanup);
  next();
};

const markUploadedFileCommitted = (req) => {
  if (req) {
    req.uploadCommitted = true;
  }
};

const uploadMessageAttachment = multer({
  storage: createStorage(messageUploadDirectory),
  fileFilter: createFileFilter(
    allowedAttachmentMimeTypes,
    "This file type is not allowed."
  ),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
    files: 1,
    fields: 10,
    parts: 12,
    fieldNestingDepth: 2
  }
});

const uploadProfileAvatar = multer({
  storage: createStorage(avatarUploadDirectory),
  fileFilter: createFileFilter(
    allowedAvatarMimeTypes,
    "Avatar must be a JPEG, PNG, WebP, or GIF image."
  ),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
    fields: 4,
    parts: 6,
    fieldNestingDepth: 2
  }
});

const validateMessageAttachmentContents = createFileContentValidator(
  "The uploaded file contents do not match the selected file type."
);
const validateAvatarContents = createFileContentValidator(
  "The uploaded avatar contents do not match the selected image type."
);

module.exports = {
  MAX_ATTACHMENT_SIZE,
  MAX_AVATAR_SIZE,
  cleanupUncommittedUpload,
  fileSignatureMatchesMimeType,
  markUploadedFileCommitted,
  uploadMessageAttachment,
  uploadProfileAvatar,
  validateAvatarContents,
  validateMessageAttachmentContents
};
