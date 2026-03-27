const { pool } = require("../config/db");

const createServer = async (ownerId, serverName, serverDescription) => {
  const [result] = await pool.query(
    "INSERT INTO servers (owner_id, server_name, server_description) VALUES (?, ?, ?)",
    [ownerId, serverName, serverDescription]
  );
  return result;
};

const addServerMember = async (serverId, userId) => {
  const [result] = await pool.query(
    "INSERT INTO server_members (server_id, user_id) VALUES (?, ?)",
    [serverId, userId]
  );
  return result;
};

const createDefaultChannel = async (serverId) => {
  const [result] = await pool.query(
    "INSERT INTO channels (server_id, channel_name) VALUES (?, ?)",
    [serverId, "general"]
  );
  return result;
};

const getServersByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT s.server_id, s.server_name, s.server_description, s.owner_id, s.created_at, s.updated_at
     FROM servers s
     JOIN server_members sm ON s.server_id = sm.server_id
     WHERE sm.user_id = ?`,
    [userId]
  );
  return rows;
};

module.exports = {
  createServer,
  addServerMember,
  createDefaultChannel,
  getServersByUserId
};