const { pool } = require("../config/db");

const getMembersByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT sm.member_id, sm.server_id, sm.user_id, sm.joined_at, u.username, u.email
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     WHERE sm.server_id = ?
     ORDER BY sm.member_id ASC`,
    [serverId]
  );

  return rows;
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    "SELECT member_id FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, userId]
  );

  return rows.length > 0;
};

module.exports = {
  getMembersByServerId,
  isUserMemberOfServer
};