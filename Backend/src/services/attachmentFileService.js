const fs = require("fs/promises");
const path = require("path");

const uploadDirectory = path.resolve(__dirname, "..", "..", "uploads", "messages");

const getStoredFilePath = (fileUrl) => {
  const normalizedUrl = String(fileUrl || "").trim();
  const prefix = "/uploads/messages/";

  if (!normalizedUrl.startsWith(prefix)) {
    return null;
  }

  const filename = path.basename(normalizedUrl.slice(prefix.length));

  if (!filename) {
    return null;
  }

  const filePath = path.resolve(uploadDirectory, filename);

  if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
    return null;
  }

  return filePath;
};

const deleteStoredFiles = async (attachments = []) => {
  const uniquePaths = [
    ...new Set(
      attachments
        .map((attachment) =>
          getStoredFilePath(
            typeof attachment === "string" ? attachment : attachment?.file_url
          )
        )
        .filter(Boolean)
    )
  ];

  await Promise.all(
    uniquePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(`Failed to delete attachment file ${filePath}:`, error.message);
        }
      }
    })
  );
};

module.exports = {
  deleteStoredFiles,
  getStoredFilePath
};
