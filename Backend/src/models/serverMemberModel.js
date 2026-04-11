const { pool } = require("../config/db");

const addServerMember = async (serverId, userId) => {
  const [result] = await pool.execute(
    "INSERT INTO server_members (server_id, user_id) VALUES (?, ?)",
    [serverId, userId]
  );

  return result;
};

const getMembersByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT
      sm.member_id,
      sm.server_id,
      sm.user_id,
      sm.joined_at,
      u.username,
      u.email,
      u.last_seen_at,
      CASE
        WHEN u.is_online = 1 THEN 'online'
        ELSE 'offline'
      END AS presence_status,
      CASE
        WHEN s.owner_id = u.user_id THEN 1
        ELSE 0
      END AS is_owner
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     JOIN servers s ON sm.server_id = s.server_id
     WHERE sm.server_id = ?
     ORDER BY is_owner DESC, u.username ASC`,
    [serverId]
  );

  return rows;
};

const getServerIdsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT server_id
     FROM server_members
     WHERE user_id = ?`,
    [userId]
  );

  return rows;
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    "SELECT member_id FROM server_members WHERE server_id = ? AND user_id = ? LIMIT 1",
    [serverId, userId]
  );

  return rows.length > 0;
};

const removeServerMember = async (serverId, userId) => {
  const [result] = await pool.execute(
    "DELETE FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, userId]
  );

  return result;
};

module.exports = {
  addServerMember,
  getMembersByServerId,
  getServerIdsByUserId,
  isUserMemberOfServer,
  removeServerMember
};