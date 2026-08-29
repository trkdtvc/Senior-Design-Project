jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/models/serverModel", () => ({
  createServerWithDefaults: jest.fn(),
  getServersByUserId: jest.fn(),
  getServerById: jest.fn(),
  updateServer: jest.fn(),
  getServerAttachmentUrls: jest.fn(),
  deleteServer: jest.fn()
}));

jest.mock("../../src/models/channelModel", () => ({
  createChannel: jest.fn(),
  getChannelsByServerId: jest.fn(),
  getChannelById: jest.fn(),
  getChannelByName: jest.fn(),
  updateChannelName: jest.fn(),
  getChannelAttachmentUrls: jest.fn(),
  deleteChannel: jest.fn(),
  isUserMemberOfServer: jest.fn()
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
const serverModel = require("../../src/models/serverModel");
const channelModel = require("../../src/models/channelModel");
const permissionModel = require("../../src/models/permissionModel");

const USER = {
  user_id: 10,
  username: "owner",
  email: "owner@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });

describe("server and channel integration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });

    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      isMember: true,
      role: "owner",
      allowed: true
    });

    serverModel.createServerWithDefaults.mockResolvedValue({ server_id: 55 });
    serverModel.getServersByUserId.mockResolvedValue([]);
    serverModel.getServerById.mockResolvedValue({
      server_id: 55,
      owner_id: USER.user_id,
      server_name: "Project",
      description: null
    });
    serverModel.getServerAttachmentUrls.mockResolvedValue([]);
    serverModel.deleteServer.mockResolvedValue({ affectedRows: 1 });

    channelModel.isUserMemberOfServer.mockResolvedValue(true);
    channelModel.getChannelByName.mockResolvedValue(null);
    channelModel.createChannel.mockResolvedValue({ insertId: 77 });
    channelModel.getChannelById.mockResolvedValue({
      channel_id: 77,
      server_id: 55,
      channel_name: "planning"
    });
    channelModel.getChannelsByServerId.mockResolvedValue([
      { channel_id: 1, server_id: 55, channel_name: "general" },
      { channel_id: 77, server_id: 55, channel_name: "planning" }
    ]);
    channelModel.getChannelAttachmentUrls.mockResolvedValue([]);
  });

  test("creates a server through the authenticated API", async () => {
    const response = await request(app)
      .post("/api/servers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        server_name: "  Project Team  ",
        description: "  Senior design chat  "
      });

    expect(response.statusCode).toBe(201);
    expect(serverModel.createServerWithDefaults).toHaveBeenCalledWith(
      USER.user_id,
      "Project Team",
      "Senior design chat"
    );
    expect(response.body.server_id).toBe(55);
  });

  test("rejects an empty server name before touching the model", async () => {
    const response = await request(app)
      .post("/api/servers")
      .set("Authorization", `Bearer ${token}`)
      .send({ server_name: "   " });

    expect(response.statusCode).toBe(400);
    expect(serverModel.createServerWithDefaults).not.toHaveBeenCalled();
  });

  test("allows an owner/admin to create a unique channel", async () => {
    const response = await request(app)
      .post("/api/channels")
      .set("Authorization", `Bearer ${token}`)
      .send({ server_id: 55, channel_name: " planning " });

    expect(response.statusCode).toBe(201);
    expect(channelModel.createChannel).toHaveBeenCalledWith(55, "planning");
    expect(response.body.channel.channel_id).toBe(77);
  });

  test("prevents a regular member from creating channels", async () => {
    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      isMember: true,
      role: "member",
      allowed: false
    });

    const response = await request(app)
      .post("/api/channels")
      .set("Authorization", `Bearer ${token}`)
      .send({ server_id: 55, channel_name: "private" });

    expect(response.statusCode).toBe(403);
    expect(channelModel.createChannel).not.toHaveBeenCalled();
  });

  test("prevents duplicate channel names", async () => {
    channelModel.getChannelByName.mockResolvedValue({
      channel_id: 5,
      channel_name: "planning"
    });

    const response = await request(app)
      .post("/api/channels")
      .set("Authorization", `Bearer ${token}`)
      .send({ server_id: 55, channel_name: "planning" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/already exists/i);
  });

  test('does not allow the "general" channel to be renamed', async () => {
    channelModel.getChannelById.mockResolvedValue({
      channel_id: 1,
      server_id: 55,
      channel_name: "general"
    });

    const response = await request(app)
      .patch("/api/channels/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ channel_name: "renamed" });

    expect(response.statusCode).toBe(400);
    expect(channelModel.updateChannelName).not.toHaveBeenCalled();
  });

  test("does not allow deletion of the final channel in a server", async () => {
    channelModel.getChannelById.mockResolvedValue({
      channel_id: 77,
      server_id: 55,
      channel_name: "planning"
    });
    channelModel.getChannelsByServerId.mockResolvedValue([
      { channel_id: 77, server_id: 55, channel_name: "planning" }
    ]);

    const response = await request(app)
      .delete("/api/channels/77")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/last remaining channel/i);
  });

  test("requires server membership before listing channels", async () => {
    channelModel.isUserMemberOfServer.mockResolvedValue(false);

    const response = await request(app)
      .get("/api/channels/55")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });

  test("only the actual owner can delete a server", async () => {
    serverModel.getServerById.mockResolvedValue({
      server_id: 55,
      owner_id: 999,
      server_name: "Not mine"
    });

    const response = await request(app)
      .delete("/api/servers/55")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(serverModel.deleteServer).not.toHaveBeenCalled();
  });
});
