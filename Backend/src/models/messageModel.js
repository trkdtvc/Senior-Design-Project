const { pool } = require("../config/db");

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 60;

const normalizeLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_MESSAGE_LIMIT;
  }

  return Math.min(parsedLimit, MAX_MESSAGE_LIMIT);
};

const createMessage = async (channelId, userId, content, replyToMessageId = null) => {
  const [result] = await pool.query(
    `INSERT INTO messages (channel_id, user_id, message_content, reply_to_message_id)
     VALUES (?, ?, ?, ?)`,
    [channelId, userId, content, replyToMessageId]
  );

  return result;
};

const createMessageAttachment = async (messageId, attachmentData) => {
  const [result] = await pool.query(
    `INSERT INTO message_attachments
      (message_id, file_url, file_name, file_type, file_size)
     VALUES (?, ?, ?, ?, ?)`,
    [
      messageId,
      attachmentData.file_url,
      attachmentData.file_name,
      attachmentData.file_type,
      attachmentData.file_size
    ]
  );

  return result;
};

const createMessageMentions = async (messageId, mentionedUserIds = []) => {
  const uniqueMentionedUserIds = [
    ...new Set(mentionedUserIds.map(Number).filter(Boolean))
  ];

  if (uniqueMentionedUserIds.length === 0) {
    return { affectedRows: 0 };
  }

  const placeholders = uniqueMentionedUserIds.map(() => "(?, ?)").join(", ");
  const values = uniqueMentionedUserIds.flatMap((mentionedUserId) => [
    messageId,
    mentionedUserId
  ]);

  const [result] = await pool.query(
    `INSERT IGNORE INTO message_mentions (message_id, mentioned_user_id)
     VALUES ${placeholders}`,
    values
  );

  return result;
};

const getAttachmentsByMessageIds = async (messageIds) => {
  if (!messageIds.length) {
    return [];
  }

  const placeholders = messageIds.map(() => "?").join(",");

  const [rows] = await pool.query(
    `SELECT
        attachment_id,
        message_id,
        file_url,
        file_name,
        file_type,
        file_size,
        created_at
     FROM message_attachments
     WHERE message_id IN (${placeholders})`,
    messageIds
  );

  return rows;
};

const attachFilesToMessages = async (messages) => {
  const messageIds = messages.map((message) => message.message_id);
  const attachments = await getAttachmentsByMessageIds(messageIds);

  return messages.map((message) => ({
    ...message,
    attachments: attachments.filter(
      (attachment) => String(attachment.message_id) === String(message.message_id)
    )
  }));
};

const baseMessageSelect = `
  SELECT
    m.message_id,
    m.channel_id,
    m.user_id,
    m.message_content AS content,
    m.reply_to_message_id,
    rm.message_content AS reply_to_content,
    rm.user_id AS reply_to_user_id,
    ru.username AS reply_to_username,
    m.created_at,
    m.updated_at,
    u.username
  FROM messages m
  JOIN users u ON m.user_id = u.user_id
  LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
  LEFT JOIN users ru ON rm.user_id = ru.user_id
`;

const hasOlderMessages = async (channelId, oldestMessageId) => {
  if (!oldestMessageId) {
    return false;
  }

  const [rows] = await pool.query(
    `SELECT message_id
     FROM messages
     WHERE channel_id = ? AND message_id < ?
     LIMIT 1`,
    [channelId, oldestMessageId]
  );

  return rows.length > 0;
};

const hasNewerMessages = async (channelId, newestMessageId) => {
  if (!newestMessageId) {
    return false;
  }

  const [rows] = await pool.query(
    `SELECT message_id
     FROM messages
     WHERE channel_id = ? AND message_id > ?
     LIMIT 1`,
    [channelId, newestMessageId]
  );

  return rows.length > 0;
};

const getMessagePaginationMeta = async (channelId, messages) => {
  if (!messages.length) {
    return {
      hasOlder: false,
      hasNewer: false,
      oldestMessageId: null,
      newestMessageId: null
    };
  }

  const oldestMessageId = messages[0].message_id;
  const newestMessageId = messages[messages.length - 1].message_id;

  const [olderExists, newerExists] = await Promise.all([
    hasOlderMessages(channelId, oldestMessageId),
    hasNewerMessages(channelId, newestMessageId)
  ]);

  return {
    hasOlder: olderExists,
    hasNewer: newerExists,
    oldestMessageId,
    newestMessageId
  };
};

const getLatestChannelMessages = async (channelId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [rows] = await pool.query(
    `${baseMessageSelect}
     WHERE m.channel_id = ?
     ORDER BY m.message_id DESC
     LIMIT ${safeLimit}`,
    [channelId]
  );

  return rows.reverse();
};

const getOlderChannelMessages = async (channelId, beforeMessageId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [rows] = await pool.query(
    `${baseMessageSelect}
     WHERE m.channel_id = ?
       AND m.message_id < ?
     ORDER BY m.message_id DESC
     LIMIT ${safeLimit}`,
    [channelId, beforeMessageId]
  );

  return rows.reverse();
};

const getChannelMessagesAround = async (channelId, aroundMessageId, limit) => {
  const safeLimit = normalizeLimit(limit);
  const olderLimit = Math.floor((safeLimit - 1) / 2);
  const newerLimit = safeLimit - olderLimit - 1;

  const [olderAndTargetRows] = await pool.query(
    `${baseMessageSelect}
     WHERE m.channel_id = ?
       AND m.message_id <= ?
     ORDER BY m.message_id DESC
     LIMIT ${olderLimit + 1}`,
    [channelId, aroundMessageId]
  );

  const [newerRows] = await pool.query(
    `${baseMessageSelect}
     WHERE m.channel_id = ?
       AND m.message_id > ?
     ORDER BY m.message_id ASC
     LIMIT ${newerLimit}`,
    [channelId, aroundMessageId]
  );

  return [...olderAndTargetRows.reverse(), ...newerRows];
};

const getMessagesByChannelId = async (channelId, options = {}) => {
  const limit = normalizeLimit(options.limit);
  let rows = [];

  if (options.aroundMessageId) {
    rows = await getChannelMessagesAround(channelId, options.aroundMessageId, limit);
  } else if (options.beforeMessageId) {
    rows = await getOlderChannelMessages(channelId, options.beforeMessageId, limit);
  } else {
    rows = await getLatestChannelMessages(channelId, limit);
  }

  const messages = await attachFilesToMessages(rows);
  const pagination = await getMessagePaginationMeta(channelId, messages);

  return {
    messages,
    pagination: {
      ...pagination,
      limit
    }
  };
};

const searchMessagesByChannelId = async (channelId, searchTerm) => {
  const searchValue = `%${searchTerm}%`;

  const [rows] = await pool.query(
    `SELECT
        m.message_id,
        m.channel_id,
        m.message_content AS content,
        m.created_at,
        u.username
     FROM messages m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.channel_id = ?
       AND m.message_content LIKE ?
     ORDER BY m.message_id ASC`,
    [channelId, searchValue]
  );

  return rows.map((row) => ({
    message_id: Number(row.message_id),
    channel_id: Number(row.channel_id),
    content: row.content,
    created_at: row.created_at,
    username: row.username
  }));
};

const getMessageById = async (messageId) => {
  const [rows] = await pool.query(
    `SELECT
        m.message_id,
        m.channel_id,
        c.server_id,
        m.user_id,
        m.message_content AS content,
        m.reply_to_message_id,
        rm.message_content AS reply_to_content,
        rm.user_id AS reply_to_user_id,
        ru.username AS reply_to_username,
        m.created_at,
        m.updated_at,
        u.username
     FROM messages m
     JOIN channels c ON m.channel_id = c.channel_id
     JOIN users u ON m.user_id = u.user_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
     LEFT JOIN users ru ON rm.user_id = ru.user_id
     WHERE m.message_id = ?
     LIMIT 1`,
    [messageId]
  );

  return rows[0] || null;
};

const updateMessageById = async (messageId, content) => {
  const [result] = await pool.query(
    `UPDATE messages
     SET message_content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE message_id = ?`,
    [content, messageId]
  );

  return result;
};

const deleteMessageAttachmentsByMessageId = async (messageId) => {
  const [result] = await pool.query(
    `DELETE FROM message_attachments
     WHERE message_id = ?`,
    [messageId]
  );

  return result;
};

const deleteMessageById = async (messageId) => {
  const [result] = await pool.query(
    `DELETE FROM messages
     WHERE message_id = ?`,
    [messageId]
  );

  return result;
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

const getMentionableServerMembersByChannelId = async (channelId) => {
  const [rows] = await pool.query(
    `SELECT
        sm.user_id,
        u.username
     FROM channels c
     JOIN server_members sm ON c.server_id = sm.server_id
     JOIN users u ON sm.user_id = u.user_id
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

const markChannelAsRead = async (channelId, userId) => {
  const [latestRows] = await pool.query(
    `SELECT message_id
     FROM messages
     WHERE channel_id = ?
     ORDER BY message_id DESC
     LIMIT 1`,
    [channelId]
  );

  const lastReadMessageId = latestRows[0]?.message_id || null;

  await pool.query(
    `INSERT INTO channel_read_states (
        user_id,
        channel_id,
        last_read_message_id,
        last_read_at
      )
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
        last_read_message_id = VALUES(last_read_message_id),
        last_read_at = CURRENT_TIMESTAMP`,
    [userId, channelId, lastReadMessageId]
  );

  return {
    user_id: Number(userId),
    channel_id: Number(channelId),
    last_read_message_id: lastReadMessageId
  };
};

const getUnreadChannelCountsByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
        c.server_id,
        c.channel_id,
        COUNT(m.message_id) AS unread_count
     FROM server_members sm
     JOIN channels c
       ON c.server_id = sm.server_id
     LEFT JOIN channel_read_states crs
       ON crs.user_id = sm.user_id
      AND crs.channel_id = c.channel_id
     JOIN messages m
       ON m.channel_id = c.channel_id
      AND m.user_id <> sm.user_id
      AND m.created_at >= sm.joined_at
      AND (
        crs.read_state_id IS NULL
        OR (
          crs.last_read_message_id IS NOT NULL
          AND m.message_id > crs.last_read_message_id
        )
        OR (
          crs.last_read_message_id IS NULL
          AND crs.last_read_at IS NOT NULL
          AND m.created_at > crs.last_read_at
        )
      )
     WHERE sm.user_id = ?
     GROUP BY c.server_id, c.channel_id
     HAVING unread_count > 0`,
    [userId]
  );

  return rows.map((row) => ({
    server_id: row.server_id,
    channel_id: row.channel_id,
    unread_count: Number(row.unread_count || 0)
  }));
};

const getUnreadMentionCountsByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
        c.server_id,
        m.channel_id,
        COUNT(mm.mention_id) AS mention_count
     FROM message_mentions mm
     JOIN messages m
       ON mm.message_id = m.message_id
     JOIN channels c
       ON m.channel_id = c.channel_id
     JOIN server_members sm
       ON sm.server_id = c.server_id
      AND sm.user_id = mm.mentioned_user_id
     LEFT JOIN channel_read_states crs
       ON crs.user_id = mm.mentioned_user_id
      AND crs.channel_id = m.channel_id
     WHERE mm.mentioned_user_id = ?
       AND m.user_id <> ?
       AND m.created_at >= sm.joined_at
       AND (
        crs.read_state_id IS NULL
        OR (
          crs.last_read_message_id IS NOT NULL
          AND m.message_id > crs.last_read_message_id
        )
        OR (
          crs.last_read_message_id IS NULL
          AND crs.last_read_at IS NOT NULL
          AND m.created_at > crs.last_read_at
        )
       )
     GROUP BY c.server_id, m.channel_id
     HAVING mention_count > 0`,
    [userId, userId]
  );

  return rows.map((row) => ({
    server_id: row.server_id,
    channel_id: row.channel_id,
    mention_count: Number(row.mention_count || 0)
  }));
};

module.exports = {
  createMessage,
  createMessageAttachment,
  createMessageMentions,
  getMessagesByChannelId,
  searchMessagesByChannelId,
  getMessageById,
  updateMessageById,
  deleteMessageAttachmentsByMessageId,
  deleteMessageById,
  getChannelServerId,
  getChannelServerMemberIds,
  getMentionableServerMembersByChannelId,
  isUserMemberOfChannelServer,
  markChannelAsRead,
  getUnreadChannelCountsByUserId,
  getUnreadMentionCountsByUserId
};
