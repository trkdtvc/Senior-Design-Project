const path = require("path");
const attachmentModel = require("../models/attachmentModel");
const { getStoredFilePath } = require("../services/attachmentFileService");

const INLINE_MIME_PREFIXES = ["image/", "video/", "audio/"];
const INLINE_MIME_TYPES = new Set(["application/pdf", "text/plain"]);

const isInlineType = (mimeType = "") =>
  INLINE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
  INLINE_MIME_TYPES.has(mimeType);

const encodeContentDispositionFilename = (filename = "attachment") =>
  encodeURIComponent(path.basename(filename)).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

const sendAuthorizedAttachment = async (req, res, next, getAttachment) => {
  try {
    const attachmentId = Number(req.params.attachmentId);

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      res.status(400);
      throw new Error("Invalid attachment ID");
    }

    const attachment = await getAttachment(attachmentId, req.user.user_id);

    if (!attachment) {
      res.status(404);
      throw new Error("Attachment not found");
    }

    const filePath = getStoredFilePath(attachment.file_url);

    if (!filePath) {
      res.status(404);
      throw new Error("Attachment file not found");
    }

    const disposition = isInlineType(attachment.file_type) ? "inline" : "attachment";
    const encodedFilename = encodeContentDispositionFilename(attachment.file_name);

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", attachment.file_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename*=UTF-8''${encodedFilename}`
    );

    return res.sendFile(filePath, (error) => {
      if (!error) {
        return;
      }

      if (error.code === "ENOENT" && !res.headersSent) {
        res.status(404);
        next(new Error("Attachment file not found"));
        return;
      }

      if (!res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

const getChannelAttachment = (req, res, next) =>
  sendAuthorizedAttachment(
    req,
    res,
    next,
    attachmentModel.getChannelAttachmentForUser
  );

const getDirectAttachment = (req, res, next) =>
  sendAuthorizedAttachment(
    req,
    res,
    next,
    attachmentModel.getDirectAttachmentForUser
  );

module.exports = {
  getChannelAttachment,
  getDirectAttachment
};
