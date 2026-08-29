jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/config/db", () => ({
  pool: {
    execute: jest.fn()
  }
}));

jest.mock("../../src/models/directMessageModel", () => ({
  getConversationByUsers: jest.fn(),
  createConversation: jest.fn(),
  getConversationById: jest.fn(),
  isUserInConversation: jest.fn(),
  getUserConversations: jest.fn(),
  getMessagesByConversationId: jest.fn(),
  getDirectMessageById: jest.fn(),
  createDirectMessage: jest.fn(),
  createDirectMessageAttachment: jest.fn(),
  getDirectMessageAttachmentsByMessageId: jest.fn(),
  updateDirectMessageById: jest.fn(),
  deleteDirectMessageAttachmentsByMessageId: jest.fn(),
  deleteDirectMessageById: jest.fn(),
  toggleDirectMessageReaction: jest.fn(),
  pinDirectMessageById: jest.fn(),
  unpinDirectMessageById: jest.fn(),
  getPinnedDirectMessagesByConversationId: jest.fn(),
  hideDirectConversationForUser: jest.fn(),
  markDirectConversationAsRead: jest.fn(),
  getUnreadDirectConversationCountsByUserId: jest.fn()
}));

jest.mock("../../src/models/userSafetyModel", () => ({
  hasBlockBetweenUsers: jest.fn(),
  getBlockBetweenUsers: jest.fn()
}));

jest.mock("../../src/services/attachmentFileService", () => ({
  deleteStoredFiles: jest.fn().mockResolvedValue(undefined),
  getStoredFilePath: jest.fn()
}));

const request = require("supertest");
const { signAuthToken } = require("../../src/services/authTokenService");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
const userModel = require("../../src/models/userModel");
const directModel = require("../../src/models/directMessageModel");
const userSafetyModel = require("../../src/models/userSafetyModel");

const USER = {
  user_id: 31,
  username: "alice",
  email: "alice@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });

const conversation = {
  conversation_id: 90,
  user_one_id: USER.user_id,
  user_two_id: 32
};

const directMessage = {
  direct_message_id: 501,
  conversation_id: 90,
  sender_id: USER.user_id,
  sender_username: USER.username,
  sender_avatar_url: null,
  content: "Hello Bob",
  user_one_id: USER.user_id,
  user_two_id: 32,
  reply_to_direct_message_id: null,
  created_at: new Date().toISOString(),
  updated_at: null,
  reactions: []
};

describe("direct messaging integration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.execute.mockReset();

    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });
    directModel.getConversationById.mockResolvedValue({ ...conversation });
    directModel.isUserInConversation.mockResolvedValue(true);
    directModel.getConversationByUsers.mockResolvedValue(null);
    directModel.createConversation.mockResolvedValue({ ...conversation });
    directModel.getUserConversations.mockResolvedValue([{ ...conversation }]);
    directModel.getMessagesByConversationId.mockResolvedValue({
      messages: [{ ...directMessage }],
      pagination: { hasOlder: false, hasNewer: false, limit: 30 }
    });
    directModel.createDirectMessage.mockResolvedValue({ ...directMessage });
    directModel.getDirectMessageById.mockResolvedValue({ ...directMessage });
    directModel.toggleDirectMessageReaction.mockResolvedValue({
      action: "added",
      reactions: [{ emoji: "❤️", count: 1, reacted_by_me: true }]
    });
    directModel.markDirectConversationAsRead.mockResolvedValue({
      conversation_id: 90,
      user_id: USER.user_id,
      last_read_direct_message_id: 501
    });
    userSafetyModel.hasBlockBetweenUsers.mockResolvedValue(false);
    userSafetyModel.getBlockBetweenUsers.mockResolvedValue(null);

    // userExists(), areUsersFriends(), and the "other user" lookup.
    pool.execute
      .mockResolvedValueOnce([[{ user_id: 32 }]])
      .mockResolvedValueOnce([[{ friendship_id: 1, user_one_id: 31, user_two_id: 32 }]])
      .mockResolvedValueOnce([[{
        user_id: 32,
        username: "bob",
        email: "bob@example.com",
        is_online: 1
      }]]);
  });

  test("creates a direct conversation only with a confirmed friend", async () => {
    const response = await request(app)
      .post("/api/direct-messages/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ friendId: 32 });

    expect(response.statusCode).toBe(201);
    expect(directModel.createConversation).toHaveBeenCalledWith(31, 32);
    expect(response.body.created).toBe(true);
    expect(response.body.conversation.other_user.username).toBe("bob");
  });

  test("does not create a direct conversation with yourself", async () => {
    const response = await request(app)
      .post("/api/direct-messages/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ friendId: USER.user_id });

    expect(response.statusCode).toBe(400);
    expect(directModel.createConversation).not.toHaveBeenCalled();
  });

  test("requires conversation participation before reading messages", async () => {
    directModel.isUserInConversation.mockResolvedValue(false);

    const response = await request(app)
      .get("/api/direct-messages/conversations/90/messages")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(directModel.getMessagesByConversationId).not.toHaveBeenCalled();
  });

  test("reads direct messages with pagination metadata", async () => {
    const response = await request(app)
      .get("/api/direct-messages/conversations/90/messages")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ limit: 30 });
  });

  test("blocks direct messages when either participant has blocked the other", async () => {
    userSafetyModel.getBlockBetweenUsers.mockResolvedValue({
      blocker_id: USER.user_id,
      blocked_id: 32
    });

    const response = await request(app)
      .post("/api/direct-messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ conversationId: 90, content: "Should fail" });

    expect(response.statusCode).toBe(403);
    expect(directModel.createDirectMessage).not.toHaveBeenCalled();
  });

  test("sends a direct message in an accessible, unblocked conversation", async () => {
    const response = await request(app)
      .post("/api/direct-messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ conversationId: 90, content: " Hello Bob " });

    expect(response.statusCode).toBe(201);
    expect(directModel.createDirectMessage).toHaveBeenCalledWith(
      90,
      USER.user_id,
      "Hello Bob",
      null
    );
  });

  test("prevents editing another user's direct message", async () => {
    directModel.getDirectMessageById.mockResolvedValue({
      ...directMessage,
      sender_id: 32
    });

    const response = await request(app)
      .put("/api/direct-messages/messages/501")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Changed" });

    expect(response.statusCode).toBe(403);
    expect(directModel.updateDirectMessageById).not.toHaveBeenCalled();
  });

  test("supports reactions for participants", async () => {
    const response = await request(app)
      .post("/api/direct-messages/messages/501/reactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ emoji: "❤️" });

    expect(response.statusCode).toBe(200);
    expect(directModel.toggleDirectMessageReaction).toHaveBeenCalledWith(
      "501",
      USER.user_id,
      "❤️"
    );
  });

  test("marks a direct conversation as read", async () => {
    const response = await request(app)
      .patch("/api/direct-messages/conversations/90/read")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(directModel.markDirectConversationAsRead).toHaveBeenCalledWith(
      "90",
      USER.user_id
    );
  });

  test("rejects unsupported direct-message attachment types as a client error", async () => {
    const response = await request(app)
      .post("/api/direct-messages")
      .set("Authorization", `Bearer ${token}`)
      .field("conversationId", "90")
      .field("content", "bad file")
      .attach("attachment", Buffer.from("binary"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload"
      });

    expect(response.statusCode).toBe(400);
  });
});
