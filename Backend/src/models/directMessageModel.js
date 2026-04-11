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
          ORDER BY dm.created_at DESC, dm.direct_message_id DESC
          LIMIT 1
        ) AS last_message_content,
        (
          SELECT dm.created_at
          FROM direct_messages dm
          WHERE dm.conversation_id = dc.conversation_id
          ORDER BY dm.created_at DESC, dm.direct_message_id DESC
          LIMIT 1
        ) AS last_message_created_at
      FROM direct_conversations dc
      JOIN users u
        ON u.user_id = CASE
          WHEN dc.user_one_id = ? THEN dc.user_two_id
          ELSE dc.user_one_id
        END
      WHERE dc.user_one_id = ? OR dc.user_two_id = ?
      ORDER BY
        COALESCE(
          (
            SELECT dm.created_at
            FROM direct_messages dm
            WHERE dm.conversation_id = dc.conversation_id
            ORDER BY dm.created_at DESC, dm.direct_message_id DESC
            LIMIT 1
          ),
          dc.updated_at
        ) DESC
    `,
    [userId, userId, userId]
  );

  return rows;
};

const getMessagesByConversationId = async (conversationId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        dm.direct_message_id,
        dm.conversation_id,
        dm.sender_id,
        u.username AS sender_username,
        dm.content,
        dm.created_at,
        dm.updated_at
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.user_id
      WHERE dm.conversation_id = ?
      ORDER BY dm.created_at ASC, dm.direct_message_id ASC
    `,
    [conversationId]
  );

  return rows;
};

const createDirectMessage = async (conversationId, senderId, content) => {
  const [result] = await pool.execute(
    `
      INSERT INTO direct_messages (conversation_id, sender_id, content)
      VALUES (?, ?, ?)
    `,
    [conversationId, senderId, content]
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
        dm.created_at,
        dm.updated_at
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.user_id
      WHERE dm.direct_message_id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0];
};

module.exports = {
  getConversationByUsers,
  createConversation,
  getConversationById,
  isUserInConversation,
  getUserConversations,
  getMessagesByConversationId,
  createDirectMessage,
};