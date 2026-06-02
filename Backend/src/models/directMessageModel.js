const { pool } = require("../config/db");

const normalizeUserPair = (userAId, userBId) => {
  const first = Number(userAId);
  const second = Number(userBId);

  return first < second ? [first, second] : [second, first];
};

const getConversationByUsers = async (userAId, userBId) => {
  const [userOneId, userTwoId] = normalizeUserPair(userAId, userBId);

  const [rows] = await pool.execute(
    `
      SELECT *
      FROM direct_conversations
      WHERE user_one_id = ? AND user_two_id = ?
      LIMIT 1
    `,
    [userOneId, userTwoId]
  );

  return rows[0] || null;
};

const createConversation = async (userAId, userBId) => {
  const [userOneId, userTwoId] = normalizeUserPair(userAId, userBId);

  const [result] = await pool.execute(
    `
      INSERT INTO direct_conversations (user_one_id, user_two_id)
      VALUES (?, ?)
    `,
    [userOneId, userTwoId]
  );

  const [rows] = await pool.execute(
    `
      SELECT *
      FROM direct_conversations
      WHERE conversation_id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0];
};

const getConversationById = async (conversationId) => {
  const [rows] = await pool.execute(
    `
      SELECT *
      FROM direct_conversations
      WHERE conversation_id = ?
      LIMIT 1
    `,
    [conversationId]
  );

  return rows[0] || null;
};

const isUserInConversation = async (conversationId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT *
      FROM direct_conversations
      WHERE conversation_id = ?
        AND (user_one_id = ? OR user_two_id = ?)
      LIMIT 1
    `,
    [conversationId, userId, userId]
  );

  return !!rows[0];
};

const getUserConversations = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        dc.conversation_id,
        dc.user_one_id,
        dc.user_two_id,
        dc.created_at,
        dc.updated_at,
        u.user_id AS other_user_id,
        u.username AS other_username,
        u.email AS other_email,
        u.is_online AS other_is_online,
        (
          SELECT dm.content
          FROM direct_messages dm
          WHERE dm.conversation_id = dc.conversation_id
            AND (
              dcd.deletion_id IS NULL
              OR dm.direct_message_id > dcd.deleted_after_message_id
            )
          ORDER BY dm.created_at DESC, dm.direct_message_id DESC
          LIMIT 1
        ) AS last_message_content,
        (
          SELECT dm.created_at
          FROM direct_messages dm
          WHERE dm.conversation_id = dc.conversation_id
            AND (
              dcd.deletion_id IS NULL
              OR dm.direct_message_id > dcd.deleted_after_message_id
            )
          ORDER BY dm.created_at DESC, dm.direct_message_id DESC
          LIMIT 1
        ) AS last_message_created_at
      FROM direct_conversations dc
      JOIN users u
        ON u.user_id = CASE
          WHEN dc.user_one_id = ? THEN dc.user_two_id
          ELSE dc.user_one_id
        END
      LEFT JOIN direct_conversation_deletions dcd
        ON dcd.conversation_id = dc.conversation_id
       AND dcd.user_id = ?
      WHERE (dc.user_one_id = ? OR dc.user_two_id = ?)
        AND (
          dcd.deletion_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM direct_messages dm_visible
            WHERE dm_visible.conversation_id = dc.conversation_id
              AND dm_visible.direct_message_id > dcd.deleted_after_message_id
            LIMIT 1
          )
        )
      ORDER BY COALESCE(last_message_created_at, dc.updated_at) DESC
    `,
    [userId, userId, userId, userId]
  );

  return rows;
};

const getDirectAttachmentsByMessageIds = async (messageIds) => {
  if (!messageIds.length) {
    return [];
  }

  const placeholders = messageIds.map(() => "?").join(",");

  const [rows] = await pool.execute(
    `SELECT
        attachment_id,
        direct_message_id,
        file_url,
        file_name,
        file_type,
        file_size,
        created_at
     FROM direct_message_attachments
     WHERE direct_message_id IN (${placeholders})`,
    messageIds
  );

  return rows;
};

const attachFilesToDirectMessages = async (messages) => {
  const messageIds = messages.map((message) => message.direct_message_id);
  const attachments = await getDirectAttachmentsByMessageIds(messageIds);

  return messages.map((message) => ({
    ...message,
    attachments: attachments.filter(
      (attachment) =>
        String(attachment.direct_message_id) === String(message.direct_message_id)
    )
  }));
};

const getMessagesByConversationId = async (conversationId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        dm.direct_message_id,
        dm.conversation_id,
        dm.sender_id,
        u.username AS sender_username,
        dm.content,
        dm.reply_to_direct_message_id,
        rdm.content AS reply_to_content,
        rdm.sender_id AS reply_to_sender_id,
        ru.username AS reply_to_sender_username,
        dm.created_at,
        dm.updated_at
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.user_id
      LEFT JOIN direct_messages rdm ON dm.reply_to_direct_message_id = rdm.direct_message_id
      LEFT JOIN users ru ON rdm.sender_id = ru.user_id
      LEFT JOIN direct_conversation_deletions dcd
        ON dcd.conversation_id = dm.conversation_id
       AND dcd.user_id = ?
      WHERE dm.conversation_id = ?
        AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
        )
      ORDER BY dm.created_at ASC, dm.direct_message_id ASC
    `,
    [userId, conversationId]
  );

  return attachFilesToDirectMessages(rows);
};

const getDirectMessageById = async (directMessageId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        dm.direct_message_id,
        dm.conversation_id,
        dm.sender_id,
        dm.content,
        dm.reply_to_direct_message_id,
        rdm.content AS reply_to_content,
        rdm.sender_id AS reply_to_sender_id,
        ru.username AS reply_to_sender_username,
        dm.created_at,
        dm.updated_at,
        dc.user_one_id,
        dc.user_two_id,
        u.username AS sender_username
      FROM direct_messages dm
      JOIN direct_conversations dc ON dm.conversation_id = dc.conversation_id
      JOIN users u ON dm.sender_id = u.user_id
      LEFT JOIN direct_messages rdm ON dm.reply_to_direct_message_id = rdm.direct_message_id
      LEFT JOIN users ru ON rdm.sender_id = ru.user_id
      WHERE dm.direct_message_id = ?
      LIMIT 1
    `,
    [directMessageId]
  );

  return rows[0] || null;
};

const createDirectMessage = async (
  conversationId,
  senderId,
  content,
  replyToDirectMessageId = null
) => {
  const [result] = await pool.execute(
    `
      INSERT INTO direct_messages (
        conversation_id,
        sender_id,
        content,
        reply_to_direct_message_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [conversationId, senderId, content, replyToDirectMessageId]
  );

  await pool.execute(
    `
      UPDATE direct_conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `,
    [conversationId]
  );

  const [rows] = await pool.execute(
    `
      SELECT
        dm.direct_message_id,
        dm.conversation_id,
        dm.sender_id,
        u.username AS sender_username,
        dm.content,
        dm.reply_to_direct_message_id,
        rdm.content AS reply_to_content,
        rdm.sender_id AS reply_to_sender_id,
        ru.username AS reply_to_sender_username,
        dm.created_at,
        dm.updated_at
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.user_id
      LEFT JOIN direct_messages rdm ON dm.reply_to_direct_message_id = rdm.direct_message_id
      LEFT JOIN users ru ON rdm.sender_id = ru.user_id
      WHERE dm.direct_message_id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return {
    ...rows[0],
    attachments: []
  };
};

const createDirectMessageAttachment = async (directMessageId, attachmentData) => {
  const [result] = await pool.execute(
    `
      INSERT INTO direct_message_attachments
        (direct_message_id, file_url, file_name, file_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      directMessageId,
      attachmentData.file_url,
      attachmentData.file_name,
      attachmentData.file_type,
      attachmentData.file_size
    ]
  );

  return result;
};

const updateDirectMessageById = async (directMessageId, content) => {
  const [result] = await pool.execute(
    `
      UPDATE direct_messages
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE direct_message_id = ?
    `,
    [content, directMessageId]
  );

  return result;
};

const deleteDirectMessageAttachmentsByMessageId = async (directMessageId) => {
  const [result] = await pool.execute(
    `
      DELETE FROM direct_message_attachments
      WHERE direct_message_id = ?
    `,
    [directMessageId]
  );

  return result;
};

const deleteDirectMessageById = async (directMessageId) => {
  const [result] = await pool.execute(
    `
      DELETE FROM direct_messages
      WHERE direct_message_id = ?
    `,
    [directMessageId]
  );

  return result;
};

const hideDirectConversationForUser = async (conversationId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT COALESCE(MAX(direct_message_id), 0) AS deleted_after_message_id
      FROM direct_messages
      WHERE conversation_id = ?
    `,
    [conversationId]
  );

  const deletedAfterMessageId = Number(rows[0]?.deleted_after_message_id || 0);

  await pool.execute(
    `
      INSERT INTO direct_conversation_deletions (
        conversation_id,
        user_id,
        deleted_after_message_id
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        deleted_after_message_id = VALUES(deleted_after_message_id),
        deleted_at = CURRENT_TIMESTAMP
    `,
    [conversationId, userId, deletedAfterMessageId]
  );

  return {
    conversation_id: Number(conversationId),
    user_id: Number(userId),
    deleted_after_message_id: deletedAfterMessageId
  };
};

const markDirectConversationAsRead = async (conversationId, userId) => {
  const [latestRows] = await pool.execute(
    `
      SELECT dm.direct_message_id
      FROM direct_messages dm
      LEFT JOIN direct_conversation_deletions dcd
        ON dcd.conversation_id = dm.conversation_id
       AND dcd.user_id = ?
      WHERE dm.conversation_id = ?
        AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
        )
      ORDER BY dm.direct_message_id DESC
      LIMIT 1
    `,
    [userId, conversationId]
  );

  const lastReadDirectMessageId = latestRows[0]?.direct_message_id || null;

  await pool.execute(
    `
      INSERT INTO direct_conversation_read_states (
        user_id,
        conversation_id,
        last_read_direct_message_id,
        last_read_at
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        last_read_direct_message_id = VALUES(last_read_direct_message_id),
        last_read_at = CURRENT_TIMESTAMP
    `,
    [userId, conversationId, lastReadDirectMessageId]
  );

  return {
    user_id: Number(userId),
    conversation_id: Number(conversationId),
    last_read_direct_message_id: lastReadDirectMessageId
  };
};

const getUnreadDirectConversationCountsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        dc.conversation_id,
        COUNT(dm.direct_message_id) AS unread_count
      FROM direct_conversations dc
      LEFT JOIN direct_conversation_deletions dcd
        ON dcd.conversation_id = dc.conversation_id
       AND dcd.user_id = ?
      LEFT JOIN direct_conversation_read_states dcrs
        ON dcrs.conversation_id = dc.conversation_id
       AND dcrs.user_id = ?
      JOIN direct_messages dm
        ON dm.conversation_id = dc.conversation_id
       AND dm.sender_id <> ?
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
       AND (
          dcrs.read_state_id IS NULL
          OR (
            dcrs.last_read_direct_message_id IS NOT NULL
            AND dm.direct_message_id > dcrs.last_read_direct_message_id
          )
          OR (
            dcrs.last_read_direct_message_id IS NULL
            AND dcrs.last_read_at IS NOT NULL
            AND dm.created_at > dcrs.last_read_at
          )
       )
      WHERE dc.user_one_id = ? OR dc.user_two_id = ?
      GROUP BY dc.conversation_id
      HAVING unread_count > 0
    `,
    [userId, userId, userId, userId, userId]
  );

  return rows.map((row) => ({
    conversation_id: row.conversation_id,
    unread_count: Number(row.unread_count || 0)
  }));
};

module.exports = {
  getConversationByUsers,
  createConversation,
  getConversationById,
  isUserInConversation,
  getUserConversations,
  getMessagesByConversationId,
  getDirectMessageById,
  createDirectMessage,
  createDirectMessageAttachment,
  updateDirectMessageById,
  deleteDirectMessageAttachmentsByMessageId,
  deleteDirectMessageById,
  hideDirectConversationForUser,
  markDirectConversationAsRead,
  getUnreadDirectConversationCountsByUserId
};