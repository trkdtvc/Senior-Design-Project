const {
  isUserMemberOfServer,
  getMembersByServerId
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

module.exports = {
  getServerMembers
};