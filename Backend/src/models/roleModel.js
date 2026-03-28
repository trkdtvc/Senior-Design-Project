const { pool } = require("../config/db");

const createRole = async (serverId, roleName) => {
  const [result] = await pool.execute(
    "INSERT INTO roles (server_id, role_name) VALUES (?, ?)",
    [serverId, roleName]
  );

  const [rows] = await pool.execute(
    "SELECT role_id, server_id, role_name, created_at FROM roles WHERE role_id = ?",
    [result.insertId]
  );

  return rows[0];
};

const getRolesByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    "SELECT role_id, server_id, role_name, created_at FROM roles WHERE server_id = ? ORDER BY role_id ASC",
    [serverId]
  );

  return rows;
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    "SELECT * FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, userId]
  );

  return rows.length > 0;
};

module.exports = {
  createRole,
  getRolesByServerId,
  isUserMemberOfServer
};