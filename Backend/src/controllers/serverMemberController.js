const {
  isUserMemberOfServer,
  getMembersByServerId,
  removeServerMember
} = require("../models/serverMemberModel");

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

module.exports = {
  getServerMembers,
  leaveServer
};