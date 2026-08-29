const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/models/attachmentModel", () => ({
  getChannelAttachmentForUser: jest.fn(),
  getDirectAttachmentForUser: jest.fn()
}));

jest.mock("../../src/services/attachmentFileService", () => ({
  getStoredFilePath: jest.fn(),
  deleteStoredFiles: jest.fn().mockResolvedValue(undefined)
}));

const request = require("supertest");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const attachmentModel = require("../../src/models/attachmentModel");
const attachmentFileService = require("../../src/services/attachmentFileService");
const { signAuthToken } = require("../../src/services/authTokenService");

const USER = {
  user_id: 81,
  username: "alice",
  email: "alice@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });
let temporaryDirectory;
let temporaryFilePath;

describe("authenticated attachment access", () => {
  beforeAll(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "chatster-attachment-"));
    temporaryFilePath = path.join(temporaryDirectory, "sample.txt");
    fs.writeFileSync(temporaryFilePath, "private attachment", "utf8");
  });

  afterAll(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });
    attachmentFileService.getStoredFilePath.mockReturnValue(temporaryFilePath);
  });

  test("requires authentication before serving attachments", async () => {
    const response = await request(app).get("/api/attachments/channel/1");

    expect(response.statusCode).toBe(401);
    expect(attachmentModel.getChannelAttachmentForUser).not.toHaveBeenCalled();
  });

  test("does not reveal an attachment when the current user has no access", async () => {
    attachmentModel.getChannelAttachmentForUser.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/attachments/channel/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(404);
    expect(attachmentModel.getChannelAttachmentForUser).toHaveBeenCalledWith(
      1,
      USER.user_id
    );
  });

  test("serves an authorized channel attachment through the protected API", async () => {
    attachmentModel.getChannelAttachmentForUser.mockResolvedValue({
      attachment_id: 1,
      message_id: 22,
      file_url: "/uploads/messages/sample.txt",
      file_name: "notes.txt",
      file_type: "text/plain",
      file_size: 18
    });

    const response = await request(app)
      .get("/api/attachments/channel/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("private attachment");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["content-disposition"]).toContain("inline");
  });

  test("checks direct-message participation through the direct attachment lookup", async () => {
    attachmentModel.getDirectAttachmentForUser.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/attachments/direct/7")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(404);
    expect(attachmentModel.getDirectAttachmentForUser).toHaveBeenCalledWith(
      7,
      USER.user_id
    );
  });
});
