const memberRoleModel = require("../models/memberRoleModel");

const assignRole = async (req, res, next) => {
  try {
    const memberId = req.body.member_id || req.body.memberId;
    const roleId = req.body.role_id || req.body.roleId;

    if (!memberId || !roleId) {
      res.status(400);
      throw new Error("Member ID and role ID are required");
    }

    const isMember = await memberRoleModel.isUserMemberOfRoleServer(roleId, req.user.user_id);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
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
    const roles = await memberRoleModel.getRolesByMemberId(memberId);

    if (roles.length > 0) {
      const isMember = await memberRoleModel.isUserMemberOfRoleServer(roles[0].role_id, req.user.user_id);

      if (!isMember) {
        res.status(403);
        throw new Error("You are not authorized to view these roles");
      }
    }

    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assignRole,
  getMemberRoles
};