const memberRoleModel = require("../models/memberRoleModel");
const { canManageServerRoles } = require("../models/permissionModel");

const assignRole = async (req, res, next) => {
  try {
    const memberId = req.body.member_id || req.body.memberId;
    const roleId = req.body.role_id || req.body.roleId;

    if (!memberId || !roleId) {
      res.status(400);
      throw new Error("Member ID and role ID are required");
    }

    const roleServer = await memberRoleModel.getRoleServerByRoleId(roleId);

    if (!roleServer) {
      res.status(404);
      throw new Error("Role not found");
    }

    const permission = await canManageServerRoles(
      roleServer.server_id,
      req.user.user_id
    );

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only the server owner can assign roles");
    }

    const validMember = await memberRoleModel.doesMemberBelongToRoleServer(memberId, roleId);

    if (!validMember) {
      res.status(400);
      throw new Error("This member does not belong to the same server as this role");
    }

    const assignment = await memberRoleModel.assignRoleToMember(memberId, roleId);

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
};

const getMemberRoles = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const memberServer = await memberRoleModel.getMemberServerByMemberId(memberId);

    if (!memberServer) {
      res.status(404);
      throw new Error("Server member not found");
    }

    const permission = await memberRoleModel.isUserMemberOfServer(
      memberServer.server_id,
      req.user.user_id
    );

    if (!permission) {
      res.status(403);
      throw new Error("You are not authorized to view these roles");
    }

    const roles = await memberRoleModel.getRolesByMemberId(memberId);

    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assignRole,
  getMemberRoles
};
