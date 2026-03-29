const serverMemberModel = require("../models/serverMemberModel");

const getServerMembers = async (req, res, next) => {
  try {
    const { serverId } = req.params;

    const isMember = await serverMemberModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    const members = await serverMemberModel.getMembersByServerId(serverId);

    res.status(200).json(members);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServerMembers
};