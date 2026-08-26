const fs = require("fs/promises");
const path = require("path");

const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads");
const storedUploadDirectories = {
  "/uploads/messages/": path.resolve(uploadsRoot, "messages"),
  "/uploads/avatars/": path.resolve(uploadsRoot, "avatars")
};

const getStoredFilePath = (fileUrl) => {
  const normalizedUrl = String(fileUrl || "").trim();
  const matchingPrefix = Object.keys(storedUploadDirectories).find((prefix) =>
    normalizedUrl.startsWith(prefix)
  );

  if (!matchingPrefix) {
    return null;
  }

  const uploadDirectory = storedUploadDirectories[matchingPrefix];
  const filename = path.basename(normalizedUrl.slice(matchingPrefix.length));

  if (!filename) {
    return null;
  }

  const filePath = path.resolve(uploadDirectory, filename);

  if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
    return null;
  }

  return filePath;
};

const deleteStoredFiles = async (files = []) => {
  const uniquePaths = [
    ...new Set(
      files
        .map((file) =>
          getStoredFilePath(
            typeof file === "string" ? file : file?.file_url || file?.avatar_url
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
          console.error(`Failed to delete stored file ${filePath}:`, error.message);
        }
      }
    })
  );
};

module.exports = {
  deleteStoredFiles,
  getStoredFilePath
};
