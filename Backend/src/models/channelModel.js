const { pool } = require("../config/db");

const createChannel = async (serverId, channelName) => {
  const [result] = await pool.query(
    "INSERT INTO channels (server_id, channel_name) VALUES (?, ?)",
    [serverId, channelName]
  );

  return result;
};

const getChannelsByServerId = async (serverId) => {
  const [rows] = await pool.query(
    `SELECT channel_id, server_id, channel_name, created_at, updated_at
     FROM channels
     WHERE server_id = ?
     ORDER BY created_at ASC`,
    [serverId]
  );

  return rows;
};

const getChannelById = async (channelId) => {
  const [rows] = await pool.query(
    `SELECT channel_id, server_id, channel_name, created_at, updated_at
     FROM channels
     WHERE channel_id = ?`,
    [channelId]
  );

  return rows[0];
};

const deleteChannel = async (channelId) => {
  const [result] = await pool.query(
    "DELETE FROM channels WHERE channel_id = ?",
    [channelId]
  );

  return result;
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM server_members
     WHERE server_id = ? AND user_id = ?`,
    [serverId, userId]
  );

  return rows.length > 0;
};

module.exports = {
  createChannel,
  getChannelsByServerId,
  getChannelById,
  deleteChannel,
  isUserMemberOfServer
};