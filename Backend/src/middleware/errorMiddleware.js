const multer = require("multer");

const getStatusCode = (err, res) => {
  if (err.statusCode || err.status) {
    return err.statusCode || err.status;
  }

  if (err instanceof multer.MulterError) {
    return 400;
  }

  return res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
};

const getKnownClientErrorMessage = (err) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return err.field === "avatar"
      ? "Profile pictures cannot exceed 5 MB."
      : "File size cannot exceed 25 MB.";
  }

  return err.message || "Request failed";
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = getStatusCode(err, res);
  const isProduction = process.env.NODE_ENV === "production";
  const isServerError = statusCode >= 500;

  if (isServerError) {
    const rawRequestPath = req.originalUrl || req.url || "";
    const requestPath = String(rawRequestPath).split("?")[0];
    const requestLabel = `${req.method || "REQUEST"} ${requestPath}`.trim();
    console.error(`[${requestLabel}]`, err.stack || err.message || err);
  }

  const responseBody = {
    message:
      isProduction && isServerError
        ? "Internal server error"
        : getKnownClientErrorMessage(err)
  };

  if (!isProduction) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = {
  notFound,
  errorHandler
};
