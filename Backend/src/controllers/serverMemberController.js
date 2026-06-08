const {
  isUserMemberOfServer,
  getMembersByServerId,
  getServerMemberByMemberId,
  removeServerMember,
  removeServerMemberByMemberId,
  setServerMemberRole
} = require("../models/serverMemberModel");
const {
  SERVER_ROLES,
  canManageServerContent,
  canManageServerRoles,
  normalizeRoleName
} = require("../models/permissionModel");

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
  updateMemberRole
};
