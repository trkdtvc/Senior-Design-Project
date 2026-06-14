const { pool } = require("../config/db");

const DEFAULT_AI_CONTEXT_LIMIT = 50;
const MAX_AI_CONTEXT_LIMIT = 80;

const normalizeLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_AI_CONTEXT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_AI_CONTEXT_LIMIT);
};

const getChannelConversationContext = async (channelId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [channelRows] = await pool.query(
    `SELECT
        c.channel_id,
        c.channel_name,
        c.server_id,
        s.server_name
     FROM channels c
     JOIN servers s ON c.server_id = s.server_id
     WHERE c.channel_id = ?
     LIMIT 1`,
    [channelId]
  );

  const channel = channelRows[0] || null;

  const [messageRows] = await pool.query(
    `SELECT
        m.message_id,
        m.message_content AS content,
        m.created_at,
        u.username
     FROM messages m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.channel_id = ?
     ORDER BY m.message_id DESC
     LIMIT ${safeLimit}`,
    [channelId]
  );

  return {
    type: "channel",
    channel_id: Number(channelId),
    server_id: channel?.server_id ? Number(channel.server_id) : null,
    title: channel
      ? `#${channel.channel_name} in ${channel.server_name}`
      : `Channel ${channelId}`,
    messages: messageRows.reverse().map((message) => ({
      id: Number(message.message_id),
      author: message.username,
      content: message.content,
      created_at: message.created_at
    }))
  };
};

const getDirectConversationContext = async (conversationId, userId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [conversationRows] = await pool.execute(
    `SELECT
        dc.conversation_id,
        dc.user_one_id,
        dc.user_two_id,
        other_user.username AS other_username
     FROM direct_conversations dc
     JOIN users other_user
       ON other_user.user_id = CASE
         WHEN dc.user_one_id = ? THEN dc.user_two_id
         ELSE dc.user_one_id
       END
     WHERE dc.conversation_id = ?
     LIMIT 1`,
    [userId, conversationId]
  );

  const conversation = conversationRows[0] || null;

  const [messageRows] = await pool.execute(
    `SELECT
        dm.direct_message_id,
        dm.content,
        dm.created_at,
        u.username
     FROM direct_messages dm
     JOIN users u ON dm.sender_id = u.user_id
     LEFT JOIN direct_conversation_deletions dcd
       ON dcd.conversation_id = dm.conversation_id
      AND dcd.user_id = ?
     WHERE dm.conversation_id = ?
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
     ORDER BY dm.direct_message_id DESC
     LIMIT ${safeLimit}`,
    [userId, conversationId]
  );

  return {
    type: "direct_message",
    conversation_id: Number(conversationId),
    title: conversation
      ? `DM with ${conversation.other_username}`
      : `Direct conversation ${conversationId}`,
    messages: messageRows.reverse().map((message) => ({
      id: Number(message.direct_message_id),
      author: message.username,
      content: message.content,
      created_at: message.created_at
    }))
  };
};

module.exports = {
  getChannelConversationContext,
  getDirectConversationContext,
  normalizeLimit
};
