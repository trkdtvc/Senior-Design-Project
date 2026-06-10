const { pool } = require("../config/db");

const DEFAULT_DIRECT_MESSAGE_LIMIT = 30;
const MAX_DIRECT_MESSAGE_LIMIT = 60;

const normalizeLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_DIRECT_MESSAGE_LIMIT;
  }

  return Math.min(parsedLimit, MAX_DIRECT_MESSAGE_LIMIT);
};

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
        EXISTS (
          SELECT 1
          FROM user_blocks ub_me
          WHERE ub_me.blocker_id = ?
            AND ub_me.blocked_id = u.user_id
        ) AS blocked_by_me,
        EXISTS (
          SELECT 1
          FROM user_blocks ub_other
          WHERE ub_other.blocker_id = u.user_id
            AND ub_other.blocked_id = ?
        ) AS blocked_me,
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
    [userId, userId, userId, userId, userId, userId]
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

const getDirectReactionsByMessageIds = async (
  directMessageIds,
  currentUserId = null
) => {
  if (!directMessageIds.length) {
    return [];
  }

  const placeholders = directMessageIds.map(() => "?").join(",");

  const [rows] = await pool.execute(
    `SELECT
        direct_message_id,
        emoji,
        COUNT(*) AS reaction_count,
        MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted_by_me,
        MIN(created_at) AS first_reacted_at
     FROM direct_message_reactions
     WHERE direct_message_id IN (${placeholders})
     GROUP BY direct_message_id, emoji
     ORDER BY first_reacted_at ASC`,
    [currentUserId || 0, ...directMessageIds]
  );

  return rows.map((row) => ({
    direct_message_id: Number(row.direct_message_id),
    emoji: row.emoji,
    count: Number(row.reaction_count || 0),
    reacted_by_me: Number(row.reacted_by_me || 0) === 1
  }));
};

const getDirectPinsByMessageIds = async (directMessageIds) => {
  if (!directMessageIds.length) {
    return [];
  }

  const placeholders = directMessageIds.map(() => "?").join(",");

  const [rows] = await pool.execute(
    `SELECT
        dmp.direct_message_id,
        dmp.pinned_by,
        u.username AS pinned_by_username,
        dmp.pinned_at
     FROM direct_message_pins dmp
     JOIN users u ON dmp.pinned_by = u.user_id
     WHERE dmp.direct_message_id IN (${placeholders})`,
    directMessageIds
  );

  return rows;
};

const attachDirectMessageMetadata = async (messages, currentUserId = null) => {
  const messageIds = messages.map((message) => message.direct_message_id);
  const [attachments, reactions, pins] = await Promise.all([
    getDirectAttachmentsByMessageIds(messageIds),
    getDirectReactionsByMessageIds(messageIds, currentUserId),
    getDirectPinsByMessageIds(messageIds)
  ]);

  return messages.map((message) => {
    const messageId = String(message.direct_message_id);
    const pin = pins.find(
      (pinRow) => String(pinRow.direct_message_id) === messageId
    );

    return {
      ...message,
      pinned: Boolean(message.pinned_at || pin?.pinned_at),
      pinned_by: message.pinned_by || pin?.pinned_by || null,
      pinned_by_username:
        message.pinned_by_username || pin?.pinned_by_username || null,
      pinned_at: message.pinned_at || pin?.pinned_at || null,
      attachments: attachments.filter(
        (attachment) =>
          String(attachment.direct_message_id) === messageId
      ),
      reactions: reactions.filter(
        (reaction) => String(reaction.direct_message_id) === messageId
      )
    };
  });
};

const directMessageSelect = `
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
    dm.updated_at,
    dmp.pinned_by,
    pu.username AS pinned_by_username,
    dmp.pinned_at
  FROM direct_messages dm
  JOIN users u ON dm.sender_id = u.user_id
  LEFT JOIN direct_messages rdm ON dm.reply_to_direct_message_id = rdm.direct_message_id
  LEFT JOIN users ru ON rdm.sender_id = ru.user_id
  LEFT JOIN direct_message_pins dmp ON dm.direct_message_id = dmp.direct_message_id
  LEFT JOIN users pu ON dmp.pinned_by = pu.user_id
  LEFT JOIN direct_conversation_deletions dcd
    ON dcd.conversation_id = dm.conversation_id
   AND dcd.user_id = ?
`;

const visibleDirectMessageWhere = `
  dm.conversation_id = ?
  AND (
    dcd.deletion_id IS NULL
    OR dm.direct_message_id > dcd.deleted_after_message_id
  )
`;

const hasOlderDirectMessages = async (conversationId, userId, oldestDirectMessageId) => {
  if (!oldestDirectMessageId) {
    return false;
  }

  const [rows] = await pool.execute(
    `SELECT dm.direct_message_id
     FROM direct_messages dm
     LEFT JOIN direct_conversation_deletions dcd
       ON dcd.conversation_id = dm.conversation_id
      AND dcd.user_id = ?
     WHERE dm.conversation_id = ?
       AND dm.direct_message_id < ?
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
     LIMIT 1`,
    [userId, conversationId, oldestDirectMessageId]
  );

  return rows.length > 0;
};

const hasNewerDirectMessages = async (conversationId, userId, newestDirectMessageId) => {
  if (!newestDirectMessageId) {
    return false;
  }

  const [rows] = await pool.execute(
    `SELECT dm.direct_message_id
     FROM direct_messages dm
     LEFT JOIN direct_conversation_deletions dcd
       ON dcd.conversation_id = dm.conversation_id
      AND dcd.user_id = ?
     WHERE dm.conversation_id = ?
       AND dm.direct_message_id > ?
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
     LIMIT 1`,
    [userId, conversationId, newestDirectMessageId]
  );

  return rows.length > 0;
};

const getDirectPaginationMeta = async (conversationId, userId, messages) => {
  if (!messages.length) {
    return {
      hasOlder: false,
      hasNewer: false,
      oldestDirectMessageId: null,
      newestDirectMessageId: null
    };
  }

  const oldestDirectMessageId = messages[0].direct_message_id;
  const newestDirectMessageId = messages[messages.length - 1].direct_message_id;

  const [olderExists, newerExists] = await Promise.all([
    hasOlderDirectMessages(conversationId, userId, oldestDirectMessageId),
    hasNewerDirectMessages(conversationId, userId, newestDirectMessageId)
  ]);

  return {
    hasOlder: olderExists,
    hasNewer: newerExists,
    oldestDirectMessageId,
    newestDirectMessageId
  };
};

const getLatestDirectMessages = async (conversationId, userId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [rows] = await pool.execute(
    `${directMessageSelect}
     WHERE ${visibleDirectMessageWhere}
     ORDER BY dm.direct_message_id DESC
     LIMIT ${safeLimit}`,
    [userId, conversationId]
  );

  return rows.reverse();
};

const getOlderDirectMessages = async (conversationId, userId, beforeDirectMessageId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [rows] = await pool.execute(
    `${directMessageSelect}
     WHERE ${visibleDirectMessageWhere}
       AND dm.direct_message_id < ?
     ORDER BY dm.direct_message_id DESC
     LIMIT ${safeLimit}`,
    [userId, conversationId, beforeDirectMessageId]
  );

  return rows.reverse();
};

const getDirectMessagesAround = async (conversationId, userId, aroundDirectMessageId, limit) => {
  const safeLimit = normalizeLimit(limit);
  const olderLimit = Math.floor((safeLimit - 1) / 2);
  const newerLimit = safeLimit - olderLimit - 1;

  const [olderAndTargetRows] = await pool.execute(
    `${directMessageSelect}
     WHERE ${visibleDirectMessageWhere}
       AND dm.direct_message_id <= ?
     ORDER BY dm.direct_message_id DESC
     LIMIT ${olderLimit + 1}`,
    [userId, conversationId, aroundDirectMessageId]
  );

  const [newerRows] = await pool.execute(
    `${directMessageSelect}
     WHERE ${visibleDirectMessageWhere}
       AND dm.direct_message_id > ?
     ORDER BY dm.direct_message_id ASC
     LIMIT ${newerLimit}`,
    [userId, conversationId, aroundDirectMessageId]
  );

  return [...olderAndTargetRows.reverse(), ...newerRows];
};

const getMessagesByConversationId = async (conversationId, userId, options = {}) => {
  const limit = normalizeLimit(options.limit);
  let rows = [];

  if (options.aroundDirectMessageId) {
    rows = await getDirectMessagesAround(
      conversationId,
      userId,
      options.aroundDirectMessageId,
      limit
    );
  } else if (options.beforeDirectMessageId) {
    rows = await getOlderDirectMessages(
      conversationId,
      userId,
      options.beforeDirectMessageId,
      limit
    );
  } else {
    rows = await getLatestDirectMessages(conversationId, userId, limit);
  }

  const messages = await attachDirectMessageMetadata(rows, userId);
  const pagination = await getDirectPaginationMeta(conversationId, userId, messages);

  return {
    messages,
    pagination: {
      ...pagination,
      limit
    }
  };
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
        u.username AS sender_username,
        dmp.pinned_by,
        pu.username AS pinned_by_username,
        dmp.pinned_at
      FROM direct_messages dm
      JOIN direct_conversations dc ON dm.conversation_id = dc.conversation_id
      JOIN users u ON dm.sender_id = u.user_id
      LEFT JOIN direct_messages rdm ON dm.reply_to_direct_message_id = rdm.direct_message_id
      LEFT JOIN users ru ON rdm.sender_id = ru.user_id
      LEFT JOIN direct_message_pins dmp ON dm.direct_message_id = dmp.direct_message_id
      LEFT JOIN users pu ON dmp.pinned_by = pu.user_id
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

const getDirectMessageReactionsByMessageId = async (
  directMessageId,
  currentUserId = null
) => {
  const reactions = await getDirectReactionsByMessageIds(
    [directMessageId],
    currentUserId
  );

  return reactions.filter(
    (reaction) => String(reaction.direct_message_id) === String(directMessageId)
  );
};

const toggleDirectMessageReaction = async (directMessageId, userId, emoji) => {
  const [existingRows] = await pool.execute(
    `SELECT reaction_id, emoji
     FROM direct_message_reactions
     WHERE direct_message_id = ? AND user_id = ?
     ORDER BY created_at ASC, reaction_id ASC`,
    [directMessageId, userId]
  );

  if (existingRows.length) {
    const matchingReaction = existingRows.find((row) => row.emoji === emoji);
    const reactionToKeep = matchingReaction || existingRows[0];

    if (existingRows.length === 1 && matchingReaction) {
      await pool.execute(
        `DELETE FROM direct_message_reactions
         WHERE reaction_id = ?`,
        [reactionToKeep.reaction_id]
      );

      return {
        action: "removed",
        reactions: await getDirectMessageReactionsByMessageId(
          directMessageId,
          userId
        )
      };
    }

    const reactionIdsToRemove = existingRows
      .filter((row) => row.reaction_id !== reactionToKeep.reaction_id)
      .map((row) => row.reaction_id);

    if (reactionIdsToRemove.length) {
      const placeholders = reactionIdsToRemove.map(() => "?").join(",");

      await pool.execute(
        `DELETE FROM direct_message_reactions
         WHERE reaction_id IN (${placeholders})`,
        reactionIdsToRemove
      );
    }

    if (reactionToKeep.emoji !== emoji) {
      await pool.execute(
        `UPDATE direct_message_reactions
         SET emoji = ?, created_at = CURRENT_TIMESTAMP
         WHERE reaction_id = ?`,
        [emoji, reactionToKeep.reaction_id]
      );
    }

    return {
      action: "updated",
      reactions: await getDirectMessageReactionsByMessageId(
        directMessageId,
        userId
      )
    };
  }

  await pool.execute(
    `INSERT INTO direct_message_reactions (direct_message_id, user_id, emoji)
     VALUES (?, ?, ?)`,
    [directMessageId, userId, emoji]
  );

  return {
    action: "added",
    reactions: await getDirectMessageReactionsByMessageId(directMessageId, userId)
  };
};

const pinDirectMessageById = async (directMessageId, userId) => {
  await pool.execute(
    `INSERT INTO direct_message_pins (direct_message_id, pinned_by)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       pinned_by = VALUES(pinned_by),
       pinned_at = CURRENT_TIMESTAMP`,
    [directMessageId, userId]
  );

  return getDirectMessageById(directMessageId);
};

const unpinDirectMessageById = async (directMessageId) => {
  const [result] = await pool.execute(
    `DELETE FROM direct_message_pins
     WHERE direct_message_id = ?`,
    [directMessageId]
  );

  return result;
};

const getPinnedDirectMessagesByConversationId = async (
  conversationId,
  userId
) => {
  const [rows] = await pool.execute(
    `${directMessageSelect}
     WHERE ${visibleDirectMessageWhere}
       AND dmp.pinned_at IS NOT NULL
     ORDER BY dmp.pinned_at DESC`,
    [userId, conversationId]
  );

  return attachDirectMessageMetadata(rows, userId);
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

const searchDirectMessagesByConversationId = async (
  conversationId,
  userId,
  searchTerm
) => {
  const safeSearchTerm = `%${String(searchTerm || "").trim()}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        dm.direct_message_id,
        dm.conversation_id,
        dm.content,
        dm.created_at,
        u.username AS sender_username
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.user_id
      LEFT JOIN direct_conversation_deletions dcd
        ON dcd.conversation_id = dm.conversation_id
       AND dcd.user_id = ?
      WHERE dm.conversation_id = ?
        AND dm.content LIKE ?
        AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
        )
      ORDER BY dm.direct_message_id ASC
    `,
    [userId, conversationId, safeSearchTerm]
  );

  return rows.map((row) => ({
    direct_message_id: Number(row.direct_message_id),
    conversation_id: Number(row.conversation_id),
    content: row.content,
    created_at: row.created_at,
    sender_username: row.sender_username
  }));
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
      LEFT JOIN user_muted_direct_conversations umdc
        ON umdc.conversation_id = dc.conversation_id
       AND umdc.user_id = ?
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
      WHERE (dc.user_one_id = ? OR dc.user_two_id = ?)
        AND umdc.mute_id IS NULL
      GROUP BY dc.conversation_id
      HAVING unread_count > 0
    `,
    [userId, userId, userId, userId, userId, userId]
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
  toggleDirectMessageReaction,
  pinDirectMessageById,
  unpinDirectMessageById,
  getPinnedDirectMessagesByConversationId,
  hideDirectConversationForUser,
  markDirectConversationAsRead,
  searchDirectMessagesByConversationId,
  getUnreadDirectConversationCountsByUserId
};
