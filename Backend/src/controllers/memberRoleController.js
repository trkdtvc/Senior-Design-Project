const memberRoleModel = require("../models/memberRoleModel");

const assignRole = async (req, res) => {
  try {
    const { memberId, roleId } = req.body;

    if (!memberId || !roleId) {
      return res.status(400).json({ message: "Member ID and role ID are required" });
    }

    const isMember = await memberRoleModel.isUserMemberOfRoleServer(roleId, req.user.user_id);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this server" });
    }

    const validMember = await memberRoleModel.doesMemberBelongToRoleServer(memberId, roleId);

    if (!validMember) {
      return res.status(400).json({ message: "This member does not belong to the same server as this role" });
    }

    const assignment = await memberRoleModel.assignRoleToMember(memberId, roleId);

    res.status(201).json(assignment);
  } catch (error) {
    console.error("Assign role error:", error);
    res.status(500).json({ message: "Server error while assigning role" });
  }
};

const getMemberRoles = async (req, res) => {
  try {
    const { memberId } = req.params;
    const roles = await memberRoleModel.getRolesByMemberId(memberId);

    if (roles.length > 0) {
      const isMember = await memberRoleModel.isUserMemberOfRoleServer(roles[0].role_id, req.user.user_id);

      if (!isMember) {
        return res.status(403).json({ message: "You are not authorized to view these roles" });
      }
    }

    res.status(200).json(roles);
  } catch (error) {
    console.error("Get member roles error:", error);
    res.status(500).json({ message: "Server error while fetching member roles" });
  }
};

module.exports = {
  assignRole,
  getMemberRoles
};