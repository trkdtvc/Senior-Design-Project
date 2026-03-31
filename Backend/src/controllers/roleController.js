const roleModel = require("../models/roleModel");

const createRole = async (req, res, next) => {
  try {
    const serverId = req.body.server_id || req.body.serverId;
    const roleName = req.body.role_name || req.body.roleName;

    if (!serverId || !roleName) {
      res.status(400);
      throw new Error("Server ID and role name are required");
    }

    const isMember = await roleModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    const role = await roleModel.createRole(serverId, roleName);

    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
};

const getServerRoles = async (req, res, next) => {
  try {
    const { serverId } = req.params;

    const isMember = await roleModel.isUserMemberOfServer(serverId, req.user.user_id);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    const roles = await roleModel.getRolesByServerId(serverId);

    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRole,
  getServerRoles
};