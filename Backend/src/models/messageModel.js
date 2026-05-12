const { pool } = require("../config/db");

const createMessage = async (channelId, userId, content) => {
  const [result] = await pool.query(
    "INSERT INTO messages (channel_id, user_id, message_content) VALUES (?, ?, ?)",
    [channelId, userId, content]
  );

  return result;
};

const getMessagesByChannelId = async (channelId) => {
  const [rows] = await pool.query(
    `SELECT
        m.message_id,
        m.channel_id,
        m.user_id,
        m.message_content AS content,
        m.created_at,
        m.updated_at,
        u.username
     FROM messages m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.channel_id = ?
     ORDER BY m.created_at ASC`,
    [channelId]
  );

  return rows;
};

const getChannelServerId = async (channelId) => {
  const [rows] = await pool.query(
    `SELECT server_id
     FROM channels
     WHERE channel_id = ?
     LIMIT 1`,
    [channelId]
  );

  return rows[0]?.server_id || null;
};

const getChannelServerMemberIds = async (channelId) => {
  const [rows] = await pool.query(
    `SELECT sm.user_id
     FROM channels c
     JOIN server_members sm ON c.server_id = sm.server_id
     WHERE c.channel_id = ?`,
    [channelId]
  );

  return rows;
};

const isUserMemberOfChannelServer = async (channelId, userId) => {
  const [rows] = await pool.query(
    `SELECT sm.*
     FROM channels c
     JOIN server_members sm ON c.server_id = sm.server_id
     WHERE c.channel_id = ? AND sm.user_id = ?`,
    [channelId, userId]
  );

  return rows.length > 0;
};

module.exports = {
  createMessage,
  getMessagesByChannelId,
  getChannelServerId,
  getChannelServerMemberIds,
  isUserMemberOfChannelServer
};