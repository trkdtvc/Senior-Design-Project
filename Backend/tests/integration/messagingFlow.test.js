jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/models/messageModel", () => ({
  createMessage: jest.fn(),
  createMessageAttachment: jest.fn(),
  getMessageAttachmentsByMessageId: jest.fn(),
  createMessageMentions: jest.fn(),
  getMessagesByChannelId: jest.fn(),
  searchMessagesByChannelId: jest.fn(),
  getMessageById: jest.fn(),
  updateMessageById: jest.fn(),
  deleteMessageAttachmentsByMessageId: jest.fn(),
  deleteMessageById: jest.fn(),
  toggleMessageReaction: jest.fn(),
  pinMessageById: jest.fn(),
  unpinMessageById: jest.fn(),
  getPinnedMessagesByChannelId: jest.fn(),
  getChannelServerId: jest.fn(),
  getChannelServerMemberIds: jest.fn(),
  getMentionableServerMembersByChannelId: jest.fn(),
  isUserMemberOfChannelServer: jest.fn(),
  markChannelAsRead: jest.fn(),
  getUnreadChannelCountsByUserId: jest.fn(),
  getUnreadMentionCountsByUserId: jest.fn()
}));

jest.mock("../../src/models/permissionModel", () => ({
  SERVER_ROLES: {
    OWNER: "owner",
    ADMIN: "admin",
    MEMBER: "member"
  },
  normalizeRoleName: jest.fn((value) => String(value || "").trim().toLowerCase()),
  canManageServerContent: jest.fn(),
  canManageServerRoles: jest.fn()
}));

jest.mock("../../src/services/attachmentFileService", () => ({
  deleteStoredFiles: jest.fn().mockResolvedValue(undefined),
  getStoredFilePath: jest.fn()
}));

const request = require("supertest");
const { signAuthToken } = require("../../src/services/authTokenService");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const messageModel = require("../../src/models/messageModel");
const permissionModel = require("../../src/models/permissionModel");

const USER = {
  user_id: 21,
  username: "alice",
  email: "alice@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });

const baseMessage = {
  message_id: 300,
  channel_id: 12,
  server_id: 8,
  user_id: USER.user_id,
  username: USER.username,
  avatar_url: null,
  content: "Hello team",
  reply_to_message_id: null,
  reply_to_content: null,
  reply_to_user_id: null,
  reply_to_username: null,
  created_at: new Date().toISOString(),
  updated_at: null,
  reactions: [],
  pinned_at: null
};

describe("channel messaging integration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });
    messageModel.isUserMemberOfChannelServer.mockResolvedValue(true);
    messageModel.createMessage.mockResolvedValue({ insertId: 300 });
    messageModel.getMessageById.mockResolvedValue({ ...baseMessage });
    messageModel.getChannelServerId.mockResolvedValue(8);
    messageModel.getChannelServerMemberIds.mockResolvedValue([
      { user_id: USER.user_id },
      { user_id: 22 }
    ]);
    messageModel.getMentionableServerMembersByChannelId.mockResolvedValue([
      { user_id: 22, username: "bob" },
      { user_id: USER.user_id, username: "alice" }
    ]);
    messageModel.searchMessagesByChannelId.mockResolvedValue([{ ...baseMessage }]);
    messageModel.toggleMessageReaction.mockResolvedValue({
      action: "added",
      reactions: [{ emoji: "👍", count: 1, reacted_by_me: true }]
    });
    messageModel.pinMessageById.mockResolvedValue({
      ...baseMessage,
      pinned_by: USER.user_id,
      pinned_by_username: USER.username,
      pinned_at: new Date().toISOString()
    });
    messageModel.markChannelAsRead.mockResolvedValue({
      channel_id: 12,
      user_id: USER.user_id,
      last_read_message_id: 300
    });
    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      role: "admin",
      allowed: true
    });
  });

  test("rejects an empty message with no attachment", async () => {
    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_id: 12, content: "   " });

    expect(response.statusCode).toBe(400);
    expect(messageModel.createMessage).not.toHaveBeenCalled();
  });

  test("rejects messages longer than 4000 characters", async () => {
    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_id: 12, content: "x".repeat(4001) });

    expect(response.statusCode).toBe(400);
  });

  test("prevents a non-member from posting in a channel", async () => {
    messageModel.isUserMemberOfChannelServer.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_id: 12, content: "Should fail" });

    expect(response.statusCode).toBe(403);
    expect(messageModel.createMessage).not.toHaveBeenCalled();
  });

  test("creates a normal channel message", async () => {
    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_id: 12, content: " Hello team " });

    expect(response.statusCode).toBe(201);
    expect(messageModel.createMessage).toHaveBeenCalledWith(
      12,
      USER.user_id,
      "Hello team",
      null
    );
    expect(response.body.data).toMatchObject({
      message_id: 300,
      channel_id: 12,
      server_id: 8,
      user_id: USER.user_id,
      content: "Hello team"
    });
  });

  test("records mentions for other members but not for the sender", async () => {
    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_id: 12, content: "@bob @alice please review" });

    expect(response.statusCode).toBe(201);
    expect(messageModel.createMessageMentions).toHaveBeenCalledWith(300, [22]);
    expect(response.body.data.mentioned_user_ids).toEqual([22]);
  });

  test("rejects a reply target from another channel", async () => {
    messageModel.getMessageById.mockResolvedValueOnce({
      ...baseMessage,
      message_id: 99,
      channel_id: 999
    });

    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({
        channel_id: 12,
        content: "Reply",
        reply_to_message_id: 99
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/same channel/i);
  });

  test("prevents editing another user's message", async () => {
    messageModel.getMessageById.mockResolvedValue({
      ...baseMessage,
      user_id: 999
    });

    const response = await request(app)
      .put("/api/messages/300")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Edited" });

    expect(response.statusCode).toBe(403);
    expect(messageModel.updateMessageById).not.toHaveBeenCalled();
  });

  test("toggles a message reaction for a channel member", async () => {
    const response = await request(app)
      .post("/api/messages/300/reactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ emoji: "👍" });

    expect(response.statusCode).toBe(200);
    expect(messageModel.toggleMessageReaction).toHaveBeenCalledWith(
      "300",
      USER.user_id,
      "👍"
    );
    expect(response.body.data.action).toBe("added");
  });

  test("only owners/admins can pin channel messages", async () => {
    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      role: "member",
      allowed: false
    });

    const response = await request(app)
      .patch("/api/messages/300/pin")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(messageModel.pinMessageById).not.toHaveBeenCalled();
  });

  test("search requires at least two characters", async () => {
    const response = await request(app)
      .get("/api/messages/search/12")
      .query({ q: "a" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
    expect(messageModel.searchMessagesByChannelId).not.toHaveBeenCalled();
  });

  test("searches messages only after membership is confirmed", async () => {
    const response = await request(app)
      .get("/api/messages/search/12")
      .query({ q: "hello" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(messageModel.searchMessagesByChannelId).toHaveBeenCalledWith(
      "12",
      "hello"
    );
    expect(response.body.total).toBe(1);
  });

  test("marks a channel as read for a valid member", async () => {
    const response = await request(app)
      .patch("/api/messages/12/read")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(messageModel.markChannelAsRead).toHaveBeenCalledWith(
      "12",
      USER.user_id
    );
  });

  test("rejects a disallowed attachment type with 400 instead of crashing", async () => {
    const response = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .field("channel_id", "12")
      .field("content", "bad attachment")
      .attach("attachment", Buffer.from("binary"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload"
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/file type is not allowed/i);
  });
});
