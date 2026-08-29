const path = require("path");

const backendRoot = path.resolve(__dirname, "..", "..");

const getUploadsRoot = () => {
  const configuredPath = String(process.env.UPLOAD_DIR || "uploads").trim();

  return path.isAbsolute(configuredPath)
    ? path.resolve(configuredPath)
    : path.resolve(backendRoot, configuredPath);
};

module.exports = {
  backendRoot,
  getUploadsRoot
};
