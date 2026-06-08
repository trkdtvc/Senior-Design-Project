const { pool } = require("../config/db");

const assignRoleToMember = async (memberId, roleId) => {
  const [result] = await pool.execute(
    "INSERT INTO member_roles (member_id, role_id) VALUES (?, ?)",
    [memberId, roleId]
  );

  const [rows] = await pool.execute(
    `SELECT mr.member_role_id, mr.member_id, mr.role_id, mr.assigned_at, r.role_name
     FROM member_roles mr
     JOIN roles r ON mr.role_id = r.role_id
     WHERE mr.member_role_id = ?`,
    [result.insertId]
  );

  return rows[0];
};

const getRolesByMemberId = async (memberId) => {
  const [rows] = await pool.execute(
    `SELECT mr.member_role_id, mr.member_id, mr.role_id, mr.assigned_at, r.role_name, r.server_id
     FROM member_roles mr
     JOIN roles r ON mr.role_id = r.role_id
     WHERE mr.member_id = ?
     ORDER BY mr.member_role_id ASC`,
    [memberId]
  );

  return rows;
};

const getRoleServerByRoleId = async (roleId) => {
  const [rows] = await pool.execute(
    `SELECT role_id, server_id, role_name
     FROM roles
     WHERE role_id = ?
     LIMIT 1`,
    [roleId]
  );

  return rows[0] || null;
};

const getMemberServerByMemberId = async (memberId) => {
  const [rows] = await pool.execute(
    `SELECT member_id, server_id, user_id
     FROM server_members
     WHERE member_id = ?
     LIMIT 1`,
    [memberId]
  );

  return rows[0] || null;
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    `SELECT member_id
     FROM server_members
     WHERE server_id = ? AND user_id = ?
     LIMIT 1`,
    [serverId, userId]
  );

  return rows.length > 0;
};

const isUserMemberOfRoleServer = async (roleId, userId) => {
  const [rows] = await pool.execute(
    `SELECT sm.member_id
     FROM roles r
     JOIN server_members sm ON r.server_id = sm.server_id
     WHERE r.role_id = ? AND sm.user_id = ?`,
    [roleId, userId]
  );

  return rows.length > 0;
};

const doesMemberBelongToRoleServer = async (memberId, roleId) => {
  const [rows] = await pool.execute(
    `SELECT sm.member_id
     FROM server_members sm
     JOIN roles r ON sm.server_id = r.server_id
     WHERE sm.member_id = ? AND r.role_id = ?`,
    [memberId, roleId]
  );

  return rows.length > 0;
};

module.exports = {
  assignRoleToMember,
  getRolesByMemberId,
  getRoleServerByRoleId,
  getMemberServerByMemberId,
  isUserMemberOfServer,
  isUserMemberOfRoleServer,
  doesMemberBelongToRoleServer
};
