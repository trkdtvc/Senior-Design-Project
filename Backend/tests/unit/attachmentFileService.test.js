jest.mock("fs/promises", () => ({
  unlink: jest.fn()
}));

const fs = require("fs/promises");
const path = require("path");
const {
  getStoredFilePath,
  deleteStoredFiles
} = require("../../src/services/attachmentFileService");

describe("attachment file service", () => {
  beforeEach(() => {
    fs.unlink.mockReset();
  });

  test("maps known upload URLs into their expected storage directories", () => {
    const filePath = getStoredFilePath("/uploads/messages/photo.png");

    expect(filePath).toContain(
      path.join("uploads", "messages", "photo.png")
    );
  });

  test("does not treat external or unknown URLs as local files", () => {
    expect(getStoredFilePath("https://example.com/file.png")).toBeNull();
    expect(getStoredFilePath("/private/file.png")).toBeNull();
  });

  test("deduplicates file deletion requests and ignores non-local URLs", async () => {
    fs.unlink.mockResolvedValue(undefined);

    await deleteStoredFiles([
      "/uploads/avatars/avatar.png",
      "/uploads/avatars/avatar.png",
      "https://example.com/avatar.png"
    ]);

    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink.mock.calls[0][0]).toContain(
      path.join("uploads", "avatars", "avatar.png")
    );
  });

  test("ignores already-missing files", async () => {
    const error = new Error("missing");
    error.code = "ENOENT";
    fs.unlink.mockRejectedValue(error);

    await expect(
      deleteStoredFiles(["/uploads/messages/missing.txt"])
    ).resolves.toBeUndefined();
  });
});
