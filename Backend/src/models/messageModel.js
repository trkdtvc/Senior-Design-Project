const { pool } = require("../config/db");

const createMessage = async (channelId, userId, content) => {
  const [result] = await pool.query(
    "INSERT INTO messages (channel_id, user_id, message_content) VALUES (?, ?, ?)",
    [channelId, userId, content]
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

const getAttachmentsByMessageIds = async (messageIds) => {
  if (!messageIds.length) {
    return [];
  }

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
     WHERE message_id IN (?)`,
    [messageIds]
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

  return attachFilesToMessages(rows);
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
  createMessageAttachment,
  getMessagesByChannelId,
  getChannelServerId,
  getChannelServerMemberIds,
  isUserMemberOfChannelServer
};