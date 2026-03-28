const roleModel = require("../models/roleModel");

const createRole = async (req, res) => {
  try {
    const { serverId, roleName } = req.body;

    if (!serverId || !roleName) {
      return res.status(400).json({ message: "Server ID and role name are required" });
    }

    const isMember = await roleModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this server" });
    }

    const role = await roleModel.createRole(serverId, roleName);

    res.status(201).json(role);
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ message: "Server error while creating role" });
  }
};

const getServerRoles = async (req, res) => {
  try {
    const { serverId } = req.params;

    const isMember = await roleModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this server" });
    }

    const roles = await roleModel.getRolesByServerId(serverId);

    res.status(200).json(roles);
  } catch (error) {
    console.error("Get server roles error:", error);
    res.status(500).json({ message: "Server error while fetching roles" });
  }
};

module.exports = {
  createRole,
  getServerRoles
};