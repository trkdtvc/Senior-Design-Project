const mockConnection = {
  execute: jest.fn(),
  query: jest.fn()
};

const mockWithTransaction = jest.fn(async (work) => work(mockConnection));

jest.mock("../../src/config/db", () => ({
  pool: {
    execute: jest.fn(),
    query: jest.fn()
  },
  withTransaction: mockWithTransaction
}));

const messageModel = require("../../src/models/messageModel");
const directMessageModel = require("../../src/models/directMessageModel");
const userModel = require("../../src/models/userModel");
const friendRequestModel = require("../../src/models/friendRequestModel");
const serverInviteModel = require("../../src/models/serverInviteModel");

describe("transactional multi-step model writes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("channel message, mentions, and attachment metadata use one transaction", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ insertId: 300 }])
      .mockResolvedValueOnce([{ insertId: 55 }]);
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await messageModel.createMessageWithMetadata({
      channelId: 12,
      userId: 21,
      content: "Hello @bob",
      replyToMessageId: null,
      mentionedUserIds: [22],
      attachmentData: {
        file_url: "/uploads/messages/file.pdf",
        file_name: "file.pdf",
        file_type: "application/pdf",
        file_size: 1234
      }
    });

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
    expect(result.messageResult.insertId).toBe(300);
    expect(result.attachmentResult.insertId).toBe(55);
  });

  test("direct message, conversation timestamp, and attachment metadata use one transaction", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ insertId: 501 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 77 }])
      .mockResolvedValueOnce([[
        {
          direct_message_id: 501,
          conversation_id: 90,
          sender_id: 31,
          sender_username: "alice",
          content: "hello",
          reply_to_direct_message_id: null
        }
      ]]);

    const result = await directMessageModel.createDirectMessageWithAttachment({
      conversationId: 90,
      senderId: 31,
      content: "hello",
      attachmentData: {
        file_url: "/uploads/messages/file.pdf",
        file_name: "file.pdf",
        file_type: "application/pdf",
        file_size: 1234
      }
    });

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(4);
    expect(result.direct_message_id).toBe(501);
    expect(result.attachments).toEqual([
      expect.objectContaining({ attachment_id: 77, direct_message_id: 501 })
    ]);
  });

  test("registration creates the user and verification-token hash atomically", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ insertId: 77 }])
      .mockResolvedValueOnce([{ insertId: 88 }]);

    const result = await userModel.createUserWithVerificationToken(
      "alice",
      "alice@example.com",
      "password-hash",
      "token-hash",
      new Date("2030-01-01T00:00:00Z")
    );

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(result.insertId).toBe(77);
  });

  test("email verification consumes the token and verifies the user in one transaction", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[
        {
          verification_id: 9,
          user_id: 41,
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
          is_unexpired: 1,
          is_verified: 0
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await userModel.consumeEmailVerificationToken("token-hash");

    expect(result.status).toBe("verified");
    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(3);
  });
  test("friend-request acceptance updates the request and friendship atomically", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 12, affectedRows: 1 }]);

    const result = await friendRequestModel.acceptFriendRequestAtomic(500, 62, 61);

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(result.requestResult.affectedRows).toBe(1);
  });

  test("replacing an active server invite is serialized and atomic", async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[{ server_id: 70 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 7 }]);

    const expiresAt = new Date("2030-01-01T00:10:00Z");
    const result = await serverInviteModel.replaceActiveServerInvite(
      70,
      61,
      "ABCD1234",
      expiresAt
    );

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(3);
    expect(mockConnection.execute.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(result.insertId).toBe(7);
  });

});
