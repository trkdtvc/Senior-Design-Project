const { pool } = require("../config/db");

const MUTE_TABLES = {
  server: {
    table: "user_muted_servers",
    targetColumn: "server_id"
  },
  channel: {
    table: "user_muted_channels",
    targetColumn: "channel_id"
  },
  direct_conversation: {
    table: "user_muted_direct_conversations",
    targetColumn: "conversation_id"
  }
};

const normalizeIdRows = (rows, key) => rows.map((row) => Number(row[key]));

const getNotificationSettings = async (userId) => {
  const [mutedServers] = await pool.query(
    `SELECT server_id
     FROM user_muted_servers
     WHERE user_id = ?`,
    [userId]
  );

  const [mutedChannels] = await pool.query(
    `SELECT channel_id
     FROM user_muted_channels
     WHERE user_id = ?`,
    [userId]
  );

  const [mutedDirectConversations] = await pool.query(
    `SELECT conversation_id
     FROM user_muted_direct_conversations
     WHERE user_id = ?`,
    [userId]
  );

  return {
    muted_server_ids: normalizeIdRows(mutedServers, "server_id"),
    muted_channel_ids: normalizeIdRows(mutedChannels, "channel_id"),
    muted_direct_conversation_ids: normalizeIdRows(
      mutedDirectConversations,
      "conversation_id"
    )
  };
};

const setMuteState = async (type, userId, targetId, muted) => {
  const muteConfig = MUTE_TABLES[type];

  if (!muteConfig) {
    throw new Error("Invalid mute type.");
  }

  if (muted) {
    await pool.query(
      `INSERT IGNORE INTO ${muteConfig.table} (user_id, ${muteConfig.targetColumn})
       VALUES (?, ?)`,
      [userId, targetId]
    );
  } else {
    await pool.query(
      `DELETE FROM ${muteConfig.table}
       WHERE user_id = ? AND ${muteConfig.targetColumn} = ?`,
      [userId, targetId]
    );
  }

  return getNotificationSettings(userId);
};

const setServerMute = (userId, serverId, muted) =>
  setMuteState("server", userId, serverId, muted);

const setChannelMute = (userId, channelId, muted) =>
  setMuteState("channel", userId, channelId, muted);

const setDirectConversationMute = (userId, conversationId, muted) =>
  setMuteState("direct_conversation", userId, conversationId, muted);

module.exports = {
  getNotificationSettings,
  setServerMute,
  setChannelMute,
  setDirectConversationMute
};
