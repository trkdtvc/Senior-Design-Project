const { pool } = require("../config/db");
const { extractSearchTerms } = require("../services/aiService");

const DEFAULT_AI_CONTEXT_LIMIT = 40;
const MAX_AI_CONTEXT_LIMIT = 80;
const DEFAULT_LATEST_FALLBACK_LIMIT = 25;

const normalizeLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_AI_CONTEXT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_AI_CONTEXT_LIMIT);
};

const toLikeValue = (term) => `%${String(term || "").toLowerCase()}%`;

const buildLikeClause = (column, terms = []) => {
  if (!terms.length) {
    return {
      sql: "",
      values: []
    };
  }

  return {
    sql: terms.map(() => `LOWER(${column}) LIKE ?`).join(" OR "),
    values: terms.map(toLikeValue)
  };
};

const normalizeChannelMessages = (messageRows = []) =>
  messageRows.reverse().map((message) => ({
    id: Number(message.message_id),
    message_id: Number(message.message_id),
    direct_message_id: null,
    author: message.username,
    content: message.content,
    created_at: message.created_at
  }));

const normalizeDirectMessages = (messageRows = []) =>
  messageRows.reverse().map((message) => ({
    id: Number(message.direct_message_id),
    message_id: null,
    direct_message_id: Number(message.direct_message_id),
    author: message.username,
    content: message.content,
    created_at: message.created_at
  }));

const getChannelDetails = async (channelId) => {
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

  return channelRows[0] || null;
};

const getDirectConversationDetails = async (conversationId, userId) => {
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

  return conversationRows[0] || null;
};

const getLatestChannelMessageRows = async (channelId, limit) => {
  const safeLimit = normalizeLimit(limit);

  const [messageRows] = await pool.query(
    `SELECT
        m.message_id,
        m.message_content AS content,
        m.created_at,
        u.username
     FROM messages m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.channel_id = ?
       AND TRIM(COALESCE(m.message_content, '')) <> ''
     ORDER BY m.message_id DESC
     LIMIT ${safeLimit}`,
    [channelId]
  );

  return messageRows;
};

const getMatchingChannelMessageRows = async (channelId, searchTerms = [], limit) => {
  const safeLimit = normalizeLimit(limit);
  const safeTerms = searchTerms.slice(0, 16);

  if (!safeTerms.length) {
    return [];
  }

  const likeClause = buildLikeClause("m.message_content", safeTerms);

  const [messageRows] = await pool.query(
    `SELECT
        m.message_id,
        m.message_content AS content,
        m.created_at,
        u.username
     FROM messages m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.channel_id = ?
       AND TRIM(COALESCE(m.message_content, '')) <> ''
       AND (${likeClause.sql})
     ORDER BY m.message_id DESC
     LIMIT ${safeLimit}`,
    [channelId, ...likeClause.values]
  );

  return messageRows;
};

const getLatestDirectMessageRows = async (conversationId, userId, limit) => {
  const safeLimit = normalizeLimit(limit);

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
       AND TRIM(COALESCE(dm.content, '')) <> ''
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
     ORDER BY dm.direct_message_id DESC
     LIMIT ${safeLimit}`,
    [userId, conversationId]
  );

  return messageRows;
};

const getMatchingDirectMessageRows = async (
  conversationId,
  userId,
  searchTerms = [],
  limit
) => {
  const safeLimit = normalizeLimit(limit);
  const safeTerms = searchTerms.slice(0, 16);

  if (!safeTerms.length) {
    return [];
  }

  const likeClause = buildLikeClause("dm.content", safeTerms);

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
       AND TRIM(COALESCE(dm.content, '')) <> ''
       AND (${likeClause.sql})
       AND (
          dcd.deletion_id IS NULL
          OR dm.direct_message_id > dcd.deleted_after_message_id
       )
     ORDER BY dm.direct_message_id DESC
     LIMIT ${safeLimit}`,
    [userId, conversationId, ...likeClause.values]
  );

  return messageRows;
};

const buildChannelContext = ({ channelId, channel, messages, retrieval }) => ({
  type: "channel",
  channel_id: Number(channelId),
  server_id: channel?.server_id ? Number(channel.server_id) : null,
  title: channel
    ? `#${channel.channel_name} in ${channel.server_name}`
    : `Channel ${channelId}`,
  retrieval,
  messages: normalizeChannelMessages(messages)
});

const buildDirectContext = ({ conversationId, conversation, messages, retrieval }) => ({
  type: "direct_message",
  conversation_id: Number(conversationId),
  title: conversation
    ? `DM with ${conversation.other_username}`
    : `Direct conversation ${conversationId}`,
  retrieval,
  messages: normalizeDirectMessages(messages)
});

const getChannelConversationContext = async (channelId, limit) => {
  const [channel, messageRows] = await Promise.all([
    getChannelDetails(channelId),
    getLatestChannelMessageRows(channelId, limit)
  ]);

  return buildChannelContext({
    channelId,
    channel,
    messages: messageRows,
    retrieval: {
      mode: "latest_context",
      search_terms: [],
      matched_message_count: messageRows.length
    }
  });
};

const getDirectConversationContext = async (conversationId, userId, limit) => {
  const [conversation, messageRows] = await Promise.all([
    getDirectConversationDetails(conversationId, userId),
    getLatestDirectMessageRows(conversationId, userId, limit)
  ]);

  return buildDirectContext({
    conversationId,
    conversation,
    messages: messageRows,
    retrieval: {
      mode: "latest_context",
      search_terms: [],
      matched_message_count: messageRows.length
    }
  });
};

const getChannelQuestionContext = async (channelId, question, limit) => {
  const safeLimit = normalizeLimit(limit);
  const searchTerms = extractSearchTerms(question);
  const channel = await getChannelDetails(channelId);

  if (!searchTerms.length) {
    const latestRows = await getLatestChannelMessageRows(
      channelId,
      DEFAULT_LATEST_FALLBACK_LIMIT
    );

    return buildChannelContext({
      channelId,
      channel,
      messages: latestRows,
      retrieval: {
        mode: "latest_context",
        search_terms: [],
        matched_message_count: latestRows.length
      }
    });
  }

  const matchingRows = await getMatchingChannelMessageRows(
    channelId,
    searchTerms,
    safeLimit
  );

  return buildChannelContext({
    channelId,
    channel,
    messages: matchingRows,
    retrieval: {
      mode: matchingRows.length ? "relevant_search" : "no_match",
      search_terms: searchTerms,
      matched_message_count: matchingRows.length
    }
  });
};

const getDirectQuestionContext = async (conversationId, userId, question, limit) => {
  const safeLimit = normalizeLimit(limit);
  const searchTerms = extractSearchTerms(question);
  const conversation = await getDirectConversationDetails(conversationId, userId);

  if (!searchTerms.length) {
    const latestRows = await getLatestDirectMessageRows(
      conversationId,
      userId,
      DEFAULT_LATEST_FALLBACK_LIMIT
    );

    return buildDirectContext({
      conversationId,
      conversation,
      messages: latestRows,
      retrieval: {
        mode: "latest_context",
        search_terms: [],
        matched_message_count: latestRows.length
      }
    });
  }

  const matchingRows = await getMatchingDirectMessageRows(
    conversationId,
    userId,
    searchTerms,
    safeLimit
  );

  return buildDirectContext({
    conversationId,
    conversation,
    messages: matchingRows,
    retrieval: {
      mode: matchingRows.length ? "relevant_search" : "no_match",
      search_terms: searchTerms,
      matched_message_count: matchingRows.length
    }
  });
};

module.exports = {
  getChannelConversationContext,
  getDirectConversationContext,
  getChannelQuestionContext,
  getDirectQuestionContext,
  normalizeLimit
};
