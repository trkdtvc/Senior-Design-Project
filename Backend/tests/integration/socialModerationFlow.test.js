jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/models/friendRequestModel", () => ({
  hasBlockBetweenUsers: jest.fn(),
  findUserByUsernameOrEmail: jest.fn(),
  getPendingFriendRequestBetweenUsers: jest.fn(),
  getFriendRequestBetweenUsers: jest.fn(),
  createFriendRequest: jest.fn(),
  resendFriendRequest: jest.fn(),
  getIncomingPendingRequestsByUserId: jest.fn(),
  getOutgoingPendingRequestsByUserId: jest.fn(),
  getFriendRequestById: jest.fn(),
  updateFriendRequestStatus: jest.fn(),
  acceptFriendRequestAtomic: jest.fn(),
  createFriendship: jest.fn(),
  getFriendshipBetweenUsers: jest.fn(),
  deleteFriendship: jest.fn(),
  getFriendsByUserId: jest.fn()
}));

jest.mock("../../src/models/userSafetyModel", () => ({
  getUserById: jest.fn(),
  getBlockBetweenUsers: jest.fn(),
  hasBlockBetweenUsers: jest.fn(),
  hasUserBlocked: jest.fn(),
  getBlockedUsersByUserId: jest.fn(),
  createBlockAndCleanup: jest.fn(),
  deleteBlock: jest.fn()
}));

jest.mock("../../src/models/serverInviteModel", () => ({
  replaceActiveServerInvite: jest.fn(),
  createServerInvite: jest.fn(),
  getInviteByCode: jest.fn(),
  getActiveInvitesByServerId: jest.fn(),
  isInviteCodeInUse: jest.fn(),
  deactivateInvite: jest.fn(),
  deactivateInvitesByServerId: jest.fn(),
  deactivateExpiredInvitesByServerId: jest.fn()
}));

jest.mock("../../src/models/serverMemberModel", () => ({
  addServerMember: jest.fn(),
  getMembersByServerId: jest.fn(),
  getServerIdsByUserId: jest.fn(),
  getServerMemberByMemberId: jest.fn(),
  isUserMemberOfServer: jest.fn(),
  removeServerMember: jest.fn(),
  removeServerMemberByMemberId: jest.fn(),
  getServerBans: jest.fn(),
  isUserBannedFromServer: jest.fn(),
  banServerMember: jest.fn(),
  unbanServerUser: jest.fn(),
  setServerMemberRole: jest.fn()
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

jest.mock("../../src/models/channelModel", () => ({
  isUserMemberOfServer: jest.fn(),
  getChannelsByServerId: jest.fn()
}));

jest.mock("../../src/models/messageModel", () => ({
  isUserMemberOfChannelServer: jest.fn()
}));

jest.mock("../../src/models/directMessageModel", () => ({
  isUserInConversation: jest.fn()
}));

jest.mock("../../src/models/notificationSettingsModel", () => ({
  getNotificationSettings: jest.fn(),
  setServerMute: jest.fn(),
  setChannelMute: jest.fn(),
  setDirectConversationMute: jest.fn()
}));

const request = require("supertest");
const { signAuthToken } = require("../../src/services/authTokenService");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const friendModel = require("../../src/models/friendRequestModel");
const userSafetyModel = require("../../src/models/userSafetyModel");
const inviteModel = require("../../src/models/serverInviteModel");
const memberModel = require("../../src/models/serverMemberModel");
const permissionModel = require("../../src/models/permissionModel");
const channelModel = require("../../src/models/channelModel");
const messageModel = require("../../src/models/messageModel");
const directModel = require("../../src/models/directMessageModel");
const notificationModel = require("../../src/models/notificationSettingsModel");

const USER = {
  user_id: 61,
  username: "owner",
  email: "owner@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });

describe("social, moderation, invite, and mute integration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });

    friendModel.findUserByUsernameOrEmail.mockResolvedValue({
      user_id: 62,
      username: "bob",
      email: "bob@example.com"
    });
    friendModel.hasBlockBetweenUsers.mockResolvedValue(false);
    friendModel.getFriendshipBetweenUsers.mockResolvedValue(null);
    friendModel.getFriendRequestBetweenUsers.mockResolvedValue(null);
    friendModel.createFriendRequest.mockResolvedValue({ insertId: 500 });
    friendModel.getFriendRequestById.mockResolvedValue({
      request_id: 500,
      sender_id: 62,
      receiver_id: USER.user_id,
      status: "pending"
    });
    friendModel.updateFriendRequestStatus.mockResolvedValue({ affectedRows: 1 });
    friendModel.acceptFriendRequestAtomic.mockResolvedValue({
      requestResult: { affectedRows: 1 },
      friendshipResult: { insertId: 1 }
    });
    friendModel.createFriendship.mockResolvedValue({ insertId: 1 });

    userSafetyModel.getUserById.mockResolvedValue({
      user_id: 62,
      username: "bob"
    });
    userSafetyModel.createBlockAndCleanup.mockResolvedValue({
      blocker_id: USER.user_id,
      blocked_id: 62
    });
    userSafetyModel.deleteBlock.mockResolvedValue({ affectedRows: 1 });

    inviteModel.getInviteByCode.mockResolvedValue({
      invite_id: 7,
      invite_code: "ABCD1234",
      server_id: 70,
      server_name: "Project",
      is_active: 1,
      expires_at: new Date(Date.now() + 60_000)
    });
    inviteModel.isInviteCodeInUse.mockResolvedValue(false);
    inviteModel.deactivateInvitesByServerId.mockResolvedValue({ affectedRows: 1 });
    inviteModel.createServerInvite.mockResolvedValue({ insertId: 7 });
    inviteModel.replaceActiveServerInvite.mockResolvedValue({ insertId: 7 });

    memberModel.isUserBannedFromServer.mockResolvedValue(false);
    memberModel.isUserMemberOfServer.mockResolvedValue(false);
    memberModel.addServerMember.mockResolvedValue({ insertId: 1 });
    memberModel.getServerMemberByMemberId.mockResolvedValue({
      member_id: 9,
      server_id: 70,
      user_id: 62,
      is_owner: 0,
      server_role: "member"
    });
    memberModel.banServerMember.mockResolvedValue({
      ban_id: 3,
      server_id: 70,
      user_id: 62,
      banned_by: USER.user_id
    });
    memberModel.unbanServerUser.mockResolvedValue({ affectedRows: 1 });
    memberModel.setServerMemberRole.mockResolvedValue({
      member_id: 9,
      server_id: 70,
      user_id: 62,
      server_role: "admin"
    });

    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      isMember: true,
      role: "owner",
      allowed: true
    });
    permissionModel.canManageServerRoles.mockResolvedValue({
      serverExists: true,
      isMember: true,
      role: "owner",
      allowed: true
    });

    channelModel.getChannelsByServerId.mockResolvedValue([]);
    channelModel.isUserMemberOfServer.mockResolvedValue(true);
    messageModel.isUserMemberOfChannelServer.mockResolvedValue(true);
    directModel.isUserInConversation.mockResolvedValue(true);

    notificationModel.setServerMute.mockResolvedValue({ muted_servers: [70] });
    notificationModel.setChannelMute.mockResolvedValue({ muted_channels: [12] });
    notificationModel.setDirectConversationMute.mockResolvedValue({
      muted_direct_conversations: [90]
    });
  });

  test("sends a friend request to another unblocked user", async () => {
    const response = await request(app)
      .post("/api/friends/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ target: "bob" });

    expect(response.statusCode).toBe(201);
    expect(friendModel.createFriendRequest).toHaveBeenCalledWith(61, 62);
    expect(response.body.request_id).toBe(500);
  });

  test("does not allow a friend request to yourself", async () => {
    friendModel.findUserByUsernameOrEmail.mockResolvedValue({
      user_id: USER.user_id,
      username: USER.username
    });

    const response = await request(app)
      .post("/api/friends/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ target: USER.username });

    expect(response.statusCode).toBe(400);
    expect(friendModel.createFriendRequest).not.toHaveBeenCalled();
  });

  test("does not allow friendship actions across a block", async () => {
    friendModel.hasBlockBetweenUsers.mockResolvedValue(true);

    const response = await request(app)
      .post("/api/friends/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ target: "bob" });

    expect(response.statusCode).toBe(403);
    expect(friendModel.createFriendRequest).not.toHaveBeenCalled();
  });

  test("only the receiver can accept a friend request", async () => {
    friendModel.getFriendRequestById.mockResolvedValue({
      request_id: 500,
      sender_id: 62,
      receiver_id: 999,
      status: "pending"
    });

    const response = await request(app)
      .patch("/api/friends/requests/500/accept")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(friendModel.acceptFriendRequestAtomic).not.toHaveBeenCalled();
  });

  test("accepts a valid pending friend request and creates the friendship", async () => {
    const response = await request(app)
      .patch("/api/friends/requests/500/accept")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(friendModel.acceptFriendRequestAtomic).toHaveBeenCalledWith(
      500,
      62,
      61
    );
  });

  test("blocks another existing user and performs relationship cleanup through the model", async () => {
    const response = await request(app)
      .post("/api/user-safety/users/62/block")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(userSafetyModel.createBlockAndCleanup).toHaveBeenCalledWith(61, 62);
  });

  test("does not allow a user to block themselves", async () => {
    const response = await request(app)
      .post("/api/user-safety/users/61/block")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
    expect(userSafetyModel.createBlockAndCleanup).not.toHaveBeenCalled();
  });

  test("prevents a banned user from joining through a valid invite", async () => {
    memberModel.isUserBannedFromServer.mockResolvedValue(true);

    const response = await request(app)
      .post("/api/server-invites/join")
      .set("Authorization", `Bearer ${token}`)
      .send({ invite_code: "ABCD1234" });

    expect(response.statusCode).toBe(403);
    expect(memberModel.addServerMember).not.toHaveBeenCalled();
  });

  test("joins a server through a valid active invite", async () => {
    const response = await request(app)
      .post("/api/server-invites/join")
      .set("Authorization", `Bearer ${token}`)
      .send({ invite_code: "ABCD1234" });

    expect(response.statusCode).toBe(200);
    expect(memberModel.addServerMember).toHaveBeenCalledWith(70, 61);
  });

  test("owner/admin can ban a regular member", async () => {
    const response = await request(app)
      .post("/api/server-members/70/members/9/ban")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Spam" });

    expect(response.statusCode).toBe(200);
    expect(memberModel.banServerMember).toHaveBeenCalledWith(
      "70",
      "9",
      USER.user_id,
      "Spam"
    );
  });

  test("admins cannot ban another admin", async () => {
    permissionModel.canManageServerContent.mockResolvedValue({
      serverExists: true,
      role: "admin",
      allowed: true
    });
    memberModel.getServerMemberByMemberId.mockResolvedValue({
      member_id: 9,
      server_id: 70,
      user_id: 62,
      is_owner: 0,
      server_role: "admin"
    });

    const response = await request(app)
      .post("/api/server-members/70/members/9/ban")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(memberModel.banServerMember).not.toHaveBeenCalled();
  });

  test("only the server owner can promote or demote members", async () => {
    permissionModel.canManageServerRoles.mockResolvedValue({
      serverExists: true,
      role: "admin",
      allowed: false
    });

    const response = await request(app)
      .patch("/api/server-members/70/members/9/role")
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });

    expect(response.statusCode).toBe(403);
    expect(memberModel.setServerMemberRole).not.toHaveBeenCalled();
  });

  test("rejects invalid role names", async () => {
    const response = await request(app)
      .patch("/api/server-members/70/members/9/role")
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "superadmin" });

    expect(response.statusCode).toBe(400);
  });

  test("only server members can mute a server", async () => {
    channelModel.isUserMemberOfServer.mockResolvedValue(false);

    const response = await request(app)
      .patch("/api/notification-settings/servers/70")
      .set("Authorization", `Bearer ${token}`)
      .send({ muted: true });

    expect(response.statusCode).toBe(403);
    expect(notificationModel.setServerMute).not.toHaveBeenCalled();
  });

  test("mutes a channel after membership is verified", async () => {
    const response = await request(app)
      .patch("/api/notification-settings/channels/12")
      .set("Authorization", `Bearer ${token}`)
      .send({ muted: true });

    expect(response.statusCode).toBe(200);
    expect(notificationModel.setChannelMute).toHaveBeenCalledWith(61, 12, true);
  });

  test("requires DM participation before muting a direct conversation", async () => {
    directModel.isUserInConversation.mockResolvedValue(false);

    const response = await request(app)
      .patch("/api/notification-settings/direct-conversations/90")
      .set("Authorization", `Bearer ${token}`)
      .send({ muted: true });

    expect(response.statusCode).toBe(403);
    expect(notificationModel.setDirectConversationMute).not.toHaveBeenCalled();
  });
});
