module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "src/controllers/**/*.js",
    "src/middleware/**/*.js",
    "src/models/permissionModel.js",
    "src/services/aiService.js",
    "src/services/attachmentFileService.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html", "lcov"]
};
