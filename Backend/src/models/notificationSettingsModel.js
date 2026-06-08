const { pool } = require("../config/db");

const getNotificationSettingsByUserId = async (userId) => {
  const [serverRows, channelRows, directRows] = await Promise.all([
    pool.execute(
      `SELECT server_id, muted_at
       FROM user_muted_servers
       WHERE user_id = ?`,
      [userId]
    ),
    pool.execute(
      `SELECT channel_id, muted_at
       FROM user_muted_channels
       WHERE user_id = ?`,
      [userId]
    ),
    pool.execute(
      `SELECT conversation_id, muted_at
       FROM user_muted_direct_conversations
       WHERE user_id = ?`,
      [userId]
    )
  ]);

  return {
    muted_server_ids: serverRows[0].map((row) => Number(row.server_id)),
    muted_channel_ids: channelRows[0].map((row) => Number(row.channel_id)),
    muted_direct_conversation_ids: directRows[0].map((row) => Number(row.conversation_id))
  };
};

const setMuteState = async ({ tableName, idColumn, userId, targetId, muted }) => {
  if (muted) {
    const [result] = await pool.execute(
      `INSERT IGNORE INTO ${tableName} (user_id, ${idColumn})
       VALUES (?, ?)`,
      [userId, targetId]
    );

    return result;
  }

  const [result] = await pool.execute(
    `DELETE FROM ${tableName}
     WHERE user_id = ? AND ${idColumn} = ?`,
    [userId, targetId]
  );

  return result;
};

const setServerMuteState = async (userId, serverId, muted) =>
  setMuteState({
    tableName: "user_muted_servers",
    idColumn: "server_id",
    userId,
    targetId: serverId,
    muted
  });

const setChannelMuteState = async (userId, channelId, muted) =>
  setMuteState({
    tableName: "user_muted_channels",
    idColumn: "channel_id",
    userId,
    targetId: channelId,
    muted
  });

const setDirectConversationMuteState = async (userId, conversationId, muted) =>
  setMuteState({
    tableName: "user_muted_direct_conversations",
    idColumn: "conversation_id",
    userId,
    targetId: conversationId,
    muted
  });

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

const isUserMemberOfChannelServer = async (channelId, userId) => {
  const [rows] = await pool.execute(
    `SELECT sm.member_id
     FROM channels c
     JOIN server_members sm ON c.server_id = sm.server_id
     WHERE c.channel_id = ? AND sm.user_id = ?
     LIMIT 1`,
    [channelId, userId]
  );

  return rows.length > 0;
};

const isUserInDirectConversation = async (conversationId, userId) => {
  const [rows] = await pool.execute(
    `SELECT conversation_id
     FROM direct_conversations
     WHERE conversation_id = ?
       AND (user_one_id = ? OR user_two_id = ?)
     LIMIT 1`,
    [conversationId, userId, userId]
  );

  return rows.length > 0;
};

module.exports = {
  getNotificationSettingsByUserId,
  setServerMuteState,
  setChannelMuteState,
  setDirectConversationMuteState,
  isUserMemberOfServer,
  isUserMemberOfChannelServer,
  isUserInDirectConversation
};
