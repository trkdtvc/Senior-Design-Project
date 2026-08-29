require("dotenv").config();
const { validateEnvironment } = require("../src/config/env");

try {
  validateEnvironment();
  console.log("Environment configuration is valid.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
