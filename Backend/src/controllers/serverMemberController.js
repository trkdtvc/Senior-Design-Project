const {
  isUserMemberOfServer,
  getMembersByServerId,
  getServerMemberByMemberId,
  removeServerMember,
  removeServerMemberByMemberId,
  getServerBans,
  banServerMember,
  unbanServerUser,
  setServerMemberRole
} = require("../models/serverMemberModel");
const channelModel = require("../models/channelModel");
const {
  SERVER_ROLES,
  canManageServerContent,
  canManageServerRoles,
  normalizeRoleName
} = require("../models/permissionModel");

const revokeServerSocketAccess = async (req, serverId, userId, reason) => {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  const channels = await channelModel.getChannelsByServerId(serverId);
  const userRoom = `user_${userId}`;

  io.in(userRoom).socketsLeave(`server_${serverId}`);

  channels.forEach((channel) => {
    io.in(userRoom).socketsLeave(`channel_${channel.channel_id}`);
  });

  io.to(userRoom).emit("server_access_revoked", {
    server_id: Number(serverId),
    reason
  });

  io.to(`server_${serverId}`).emit("server_members_updated", {
    server_id: Number(serverId)
  });
};

const emitServerBansUpdated = (req, serverId) => {
  const io = req.app.get("io");

  if (io) {
    io.to(`server_${serverId}`).emit("server_bans_updated", {
      server_id: Number(serverId)
    });
  }
};

const getServerMembers = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("Access denied. You are not a member of this server.");
    }

    const members = await getMembersByServerId(serverId);

    res.status(200).json(members);
  } catch (error) {
    next(error);
  }
};

const leaveServer = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(404);
      throw new Error("You are not a member of this server.");
    }

    const members = await getMembersByServerId(serverId);

    const currentMember = members.find(
      (member) => String(member.user_id) === String(userId)
    );

    if (currentMember?.is_owner === 1 || currentMember?.is_owner === true) {
      res.status(400);
      throw new Error("Server owner cannot leave their own server.");
    }

    await removeServerMember(serverId, userId);
    await revokeServerSocketAccess(req, serverId, userId, "left");

    res.status(200).json({
      message: "Left server successfully."
    });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const { serverId, memberId } = req.params;
    const userId = req.user.user_id;

    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found.");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can remove members.");
    }

    const targetMember = await getServerMemberByMemberId(memberId);

    if (!targetMember || String(targetMember.server_id) !== String(serverId)) {
      res.status(404);
      throw new Error("Server member not found.");
    }

    if (String(targetMember.user_id) === String(userId)) {
      res.status(400);
      throw new Error("Use the leave server option to remove yourself.");
    }

    if (targetMember.is_owner === 1 || targetMember.is_owner === true) {
      res.status(400);
      throw new Error("The server owner cannot be removed.");
    }

    if (
      permission.role === SERVER_ROLES.ADMIN &&
      targetMember.server_role !== SERVER_ROLES.MEMBER
    ) {
      res.status(403);
      throw new Error("Admins can only remove regular members.");
    }

    await removeServerMemberByMemberId(memberId);
    await revokeServerSocketAccess(
      req,
      serverId,
      targetMember.user_id,
      "removed"
    );

    res.status(200).json({
      message: "Member removed successfully.",
      member_id: Number(memberId),
      user_id: Number(targetMember.user_id),
      server_id: Number(serverId)
    });
  } catch (error) {
    next(error);
  }
};

const getBannedUsers = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;
    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found.");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can view banned users.");
    }

    const bans = await getServerBans(serverId);

    res.status(200).json({
      message: "Banned users fetched successfully.",
      bans
    });
  } catch (error) {
    next(error);
  }
};

const banMember = async (req, res, next) => {
  try {
    const { serverId, memberId } = req.params;
    const userId = req.user.user_id;
    const reason = String(req.body?.reason || "").trim().slice(0, 255) || null;

    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found.");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can ban members.");
    }

    const targetMember = await getServerMemberByMemberId(memberId);

    if (!targetMember || String(targetMember.server_id) !== String(serverId)) {
      res.status(404);
      throw new Error("Server member not found.");
    }

    if (String(targetMember.user_id) === String(userId)) {
      res.status(400);
      throw new Error("You cannot ban yourself.");
    }

    if (targetMember.is_owner === 1 || targetMember.is_owner === true) {
      res.status(400);
      throw new Error("The server owner cannot be banned.");
    }

    if (
      permission.role === SERVER_ROLES.ADMIN &&
      targetMember.server_role !== SERVER_ROLES.MEMBER
    ) {
      res.status(403);
      throw new Error("Admins can only ban regular members.");
    }

    const ban = await banServerMember(serverId, memberId, userId, reason);

    await revokeServerSocketAccess(req, serverId, targetMember.user_id, "banned");
    emitServerBansUpdated(req, serverId);

    res.status(200).json({
      message: "Member banned successfully.",
      ban
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    next(error);
  }
};

const unbanMember = async (req, res, next) => {
  try {
    const { serverId, userId: bannedUserId } = req.params;
    const currentUserId = req.user.user_id;
    const permission = await canManageServerContent(serverId, currentUserId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found.");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can unban users.");
    }

    const result = await unbanServerUser(serverId, bannedUserId);

    if (!result.affectedRows) {
      res.status(404);
      throw new Error("Ban not found.");
    }

    emitServerBansUpdated(req, serverId);

    res.status(200).json({
      message: "User unbanned successfully.",
      user_id: Number(bannedUserId),
      server_id: Number(serverId)
    });
  } catch (error) {
    next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const { serverId, memberId } = req.params;
    const requestedRole = normalizeRoleName(req.body.role || req.body.role_name);
    const userId = req.user.user_id;

    if (![SERVER_ROLES.ADMIN, SERVER_ROLES.MEMBER].includes(requestedRole)) {
      res.status(400);
      throw new Error("Role must be admin or member.");
    }

    const permission = await canManageServerRoles(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found.");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only the server owner can change member roles.");
    }

    const updatedMember = await setServerMemberRole(
      serverId,
      memberId,
      requestedRole
    );

    const io = req.app.get("io");

    if (io) {
      io.to(`server_${serverId}`).emit("server_members_updated", {
        server_id: Number(serverId)
      });
    }

    res.status(200).json({
      message: "Member role updated successfully.",
      member: updatedMember
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    next(error);
  }
};

module.exports = {
  getServerMembers,
  leaveServer,
  removeMember,
  getBannedUsers,
  banMember,
  unbanMember,
  updateMemberRole
};
