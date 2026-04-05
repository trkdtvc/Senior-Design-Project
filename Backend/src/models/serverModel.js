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

const getServerById = async (serverId) => {
  const [rows] = await pool.query(
    "SELECT server_id, owner_id, server_name, server_description FROM servers WHERE server_id = ?",
    [serverId]
  );

  return rows[0];
};

const deleteServer = async (serverId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `DELETE m
       FROM messages m
       INNER JOIN channels c ON m.channel_id = c.channel_id
       WHERE c.server_id = ?`,
      [serverId]
    );

    await connection.query(
      "DELETE FROM member_roles WHERE member_id IN (SELECT member_id FROM server_members WHERE server_id = ?)",
      [serverId]
    );

    await connection.query(
      "DELETE FROM roles WHERE server_id = ?",
      [serverId]
    );

    await connection.query(
      "DELETE FROM channels WHERE server_id = ?",
      [serverId]
    );

    await connection.query(
      "DELETE FROM server_members WHERE server_id = ?",
      [serverId]
    );

    await connection.query(
      "DELETE FROM servers WHERE server_id = ?",
      [serverId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createServer,
  addServerMember,
  createDefaultChannel,
  getServersByUserId,
  getServerById,
  deleteServer
};