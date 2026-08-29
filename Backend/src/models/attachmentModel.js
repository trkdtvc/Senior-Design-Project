const { pool } = require("../config/db");

const getChannelAttachmentForUser = async (attachmentId, userId) => {
  const [rows] = await pool.execute(
    `SELECT
       ma.attachment_id,
       ma.message_id,
       ma.file_url,
       ma.file_name,
       ma.file_type,
       ma.file_size
     FROM message_attachments ma
     INNER JOIN messages m ON m.message_id = ma.message_id
     INNER JOIN channels c ON c.channel_id = m.channel_id
     INNER JOIN server_members sm
       ON sm.server_id = c.server_id
      AND sm.user_id = ?
     WHERE ma.attachment_id = ?
     LIMIT 1`,
    [userId, attachmentId]
  );

  return rows[0] || null;
};

const getDirectAttachmentForUser = async (attachmentId, userId) => {
  const [rows] = await pool.execute(
    `SELECT
       dma.attachment_id,
       dma.direct_message_id,
       dma.file_url,
       dma.file_name,
       dma.file_type,
       dma.file_size
     FROM direct_message_attachments dma
     INNER JOIN direct_messages dm
       ON dm.direct_message_id = dma.direct_message_id
     INNER JOIN direct_conversations dc
       ON dc.conversation_id = dm.conversation_id
     WHERE dma.attachment_id = ?
       AND (dc.user_one_id = ? OR dc.user_two_id = ?)
     LIMIT 1`,
    [attachmentId, userId, userId]
  );

  return rows[0] || null;
};

module.exports = {
  getChannelAttachmentForUser,
  getDirectAttachmentForUser
};
