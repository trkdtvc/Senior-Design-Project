const { pool } = require("../config/db");
const {
  getConversationByUsers,
  createConversation,
  getConversationById,
  isUserInConversation,
  getUserConversations,
  getMessagesByConversationId,
  createDirectMessage,
} = require("../models/directMessageModel");

const areUsersFriends = async (userAId, userBId) => {
  console.log("DM friendship check:", {
    userAId,
    userBId,
    typeA: typeof userAId,
    typeB: typeof userBId,
  });

  const [rows] = await pool.execute(
    `
      SELECT friendship_id, user_one_id, user_two_id
      FROM friendships
      WHERE (user_one_id = ? AND user_two_id = ?)
         OR (user_one_id = ? AND user_two_id = ?)
      LIMIT 1
    `,
    [userAId, userBId, userBId, userAId]
  );

  console.log("DM friendship result rows:", rows);

  return !!rows[0];
};

const userExists = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT user_id
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  return !!rows[0];
};

const getOrCreateDirectConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { friendId } = req.body;

    console.log("DM create request:", {
        currentUserId,
        friendId,
        body: req.body,
    });

    if (!friendId) {
      res.status(400);
      throw new Error("Friend ID is required");
    }

    if (Number(friendId) === Number(currentUserId)) {
      res.status(400);
      throw new Error("You cannot create a direct conversation with yourself");
    }

    const friendUserExists = await userExists(friendId);

    if (!friendUserExists) {
      res.status(404);
      throw new Error("Friend user not found");
    }

    const friends = await areUsersFriends(currentUserId, friendId);

    if (!friends) {
      res.status(403);
      throw new Error("You can only create direct conversations with confirmed friends");
    }

    let conversation = await getConversationByUsers(currentUserId, friendId);
    let created = false;

    if (!conversation) {
      conversation = await createConversation(currentUserId, friendId);
      created = true;
    }

    const [otherUserRows] = await pool.execute(
      `
        SELECT user_id, username, email, is_online
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
      [friendId]
    );

    res.status(created ? 201 : 200).json({
      message: created
        ? "Direct conversation created successfully"
        : "Direct conversation already exists",
      created,
      conversation: {
        ...conversation,
        other_user: otherUserRows[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyDirectConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const conversations = await getUserConversations(currentUserId);

    res.status(200).json({
      message: "Direct conversations fetched successfully",
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

const getDirectMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { conversationId } = req.params;

    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      res.status(404);
      throw new Error("Direct conversation not found");
    }

    const hasAccess = await isUserInConversation(conversationId, currentUserId);

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a participant in this direct conversation");
    }

    const messages = await getMessagesByConversationId(conversationId);

    res.status(200).json({
      message: "Direct messages fetched successfully",
      messages,
    });
  } catch (error) {
    next(error);
  }
};

const sendDirectMessageToConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { conversationId, content } = req.body;

    if (!conversationId) {
      res.status(400);
      throw new Error("Conversation ID is required");
    }

    if (!content || !content.trim()) {
      res.status(400);
      throw new Error("Message content is required");
    }

    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      res.status(404);
      throw new Error("Direct conversation not found");
    }

    const hasAccess = await isUserInConversation(conversationId, currentUserId);

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a participant in this direct conversation");
    }

    const newMessage = await createDirectMessage(
      conversationId,
      currentUserId,
      content.trim()
    );

    res.status(201).json({
      message: "Direct message sent successfully",
      directMessage: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateDirectConversation,
  getMyDirectConversations,
  getDirectMessages,
  sendDirectMessageToConversation,
};