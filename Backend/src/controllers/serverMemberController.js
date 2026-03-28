const serverMemberModel = require("../models/serverMemberModel");

const getServerMembers = async (req, res) => {
  try {
    const { serverId } = req.params;

    const isMember = await serverMemberModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this server" });
    }

    const members = await serverMemberModel.getMembersByServerId(serverId);

    res.status(200).json(members);
  } catch (error) {
    console.error("Get server members error:", error);
    res.status(500).json({ message: "Server error while fetching server members" });
  }
};

module.exports = {
  getServerMembers
};