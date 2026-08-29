const path = require("path");
const { backendRoot, getUploadsRoot } = require("../../src/config/paths");

const originalUploadDir = process.env.UPLOAD_DIR;

afterEach(() => {
  if (originalUploadDir === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = originalUploadDir;
  }
});

test("upload storage defaults to Backend/uploads", () => {
  delete process.env.UPLOAD_DIR;

  expect(getUploadsRoot()).toBe(path.resolve(backendRoot, "uploads"));
});

test("relative upload storage is resolved from the Backend directory", () => {
  process.env.UPLOAD_DIR = "runtime/uploads";

  expect(getUploadsRoot()).toBe(path.resolve(backendRoot, "runtime/uploads"));
});

test("absolute upload storage paths are preserved", () => {
  const absolutePath = path.resolve(backendRoot, "..", "persistent-uploads");
  process.env.UPLOAD_DIR = absolutePath;

  expect(getUploadsRoot()).toBe(absolutePath);
});
