const fs = require("fs");
const fsPromises = require("fs/promises");
const { pool } = require("../config/db");
const { getUploadsRoot } = require("../config/paths");

const live = (req, res) =>
  res.status(200).json({
    status: "ok"
  });

const ready = async (req, res) => {
  try {
    await Promise.all([
      pool.query("SELECT 1"),
      fsPromises.access(
        getUploadsRoot(),
        fs.constants.R_OK | fs.constants.W_OK
      )
    ]);

    return res.status(200).json({
      status: "ready"
    });
  } catch (error) {
    console.error("Readiness check failed:", error.message);

    return res.status(503).json({
      status: "unavailable"
    });
  }
};

module.exports = {
  live,
  ready
};
