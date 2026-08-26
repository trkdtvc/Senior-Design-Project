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

const getErrorMessage = (err) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return err.field === "avatar"
      ? "Profile pictures cannot exceed 5 MB."
      : "File size cannot exceed 25 MB.";
  }

  return err.message || "Server Error";
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = getStatusCode(err, res);
  const responseBody = {
    message: getErrorMessage(err)
  };

  if (process.env.NODE_ENV !== "production") {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = {
  notFound,
  errorHandler
};
