const {
  fileSignatureMatchesMimeType
} = require("../../src/middleware/uploadMiddleware");

describe("upload content validation", () => {
  test("accepts a PNG signature for a PNG upload", () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
    ]);

    expect(fileSignatureMatchesMimeType(pngHeader, "image/png")).toBe(true);
  });

  test("rejects HTML content disguised as an image", () => {
    const html = Buffer.from("<script>alert('xss')</script>", "utf8");

    expect(fileSignatureMatchesMimeType(html, "image/png")).toBe(false);
  });

  test("accepts ZIP signatures for modern Office documents", () => {
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

    expect(
      fileSignatureMatchesMimeType(
        zipHeader,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
  });

  test("rejects binary content declared as plain text", () => {
    const binary = Buffer.from([0xff, 0x00, 0xfe, 0x01]);

    expect(fileSignatureMatchesMimeType(binary, "text/plain")).toBe(false);
  });
});
