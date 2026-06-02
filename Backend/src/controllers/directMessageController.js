const { pool } = require("../config/db");
const {
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
} = require("../models/directMessageModel");

const createAttachmentPayload = (file) => {
  if (!file) {
    return null;
  }

  return {
    file_url: `/uploads/messages/${file.filename}`,
    file_name: file.originalname,
    file_type: file.mimetype,
    file_size: file.size
  };
};

const buildDirectReplyPreview = (message) => {
  if (!message?.reply_to_direct_message_id) {
    return null;
  }

  return {
    direct_message_id: Number(message.reply_to_direct_message_id),
    sender_id: message.reply_to_sender_id
      ? Number(message.reply_to_sender_id)
      : null,
    sender_username: message.reply_to_sender_username || "Unknown user",
    content: message.reply_to_content || ""
  };
};

const areUsersFriends = async (userAId, userBId) => {
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
        other_user: otherUserRows[0] || null
      }
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
      conversations
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

    const messages = await getMessagesByConversationId(
      conversationId,
      currentUserId
    );

    const messagesWithReplies = messages.map((message) => ({
      ...message,
      reply_to: buildDirectReplyPreview(message)
    }));

    res.status(200).json({
      message: "Direct messages fetched successfully",
      messages: messagesWithReplies
    });
  } catch (error) {
    next(error);
  }
};

const sendDirectMessageToConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { conversationId } = req.body;
    const content = req.body.content || "";
    const replyToDirectMessageId =
      req.body.reply_to_direct_message_id ||
      req.body.replyToDirectMessageId ||
      null;
    const trimmedContent = content.trim();
    const attachmentPayload = createAttachmentPayload(req.file);

    if (!conversationId) {
      res.status(400);
      throw new Error("Conversation ID is required");
    }

    if (!trimmedContent && !attachmentPayload) {
      res.status(400);
      throw new Error("Message content or attachment is required");
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

    let replyToMessage = null;

    if (replyToDirectMessageId) {
      replyToMessage = await getDirectMessageById(replyToDirectMessageId);

      if (!replyToMessage) {
        res.status(404);
        throw new Error("Reply target direct message not found");
      }

      if (String(replyToMessage.conversation_id) !== String(conversationId)) {
        res.status(400);
        throw new Error("You can only reply to messages in the same direct conversation");
      }
    }

    const newMessage = await createDirectMessage(
      conversationId,
      currentUserId,
      trimmedContent,
      replyToDirectMessageId || null
    );

    if (attachmentPayload) {
      const attachmentResult = await createDirectMessageAttachment(
        newMessage.direct_message_id,
        attachmentPayload
      );

      newMessage.attachments = [
        {
          attachment_id: attachmentResult.insertId,
          direct_message_id: newMessage.direct_message_id,
          ...attachmentPayload
        }
      ];
    }

    newMessage.reply_to = buildDirectReplyPreview(newMessage);

    const io = req.app.get("io");
    const otherUserId =
      Number(conversation.user_one_id) === Number(currentUserId)
        ? Number(conversation.user_two_id)
        : Number(conversation.user_one_id);

    const socketPayload = {
      conversation_id: Number(conversationId),
      sender_user_id: Number(currentUserId),
      recipient_user_id: otherUserId,
      directMessage: newMessage
    };

    if (io) {
      io.to(`user_${currentUserId}`).emit("direct_message", socketPayload);
      io.to(`user_${otherUserId}`).emit("direct_message", socketPayload);
    }

    res.status(201).json({
      message: "Direct message sent successfully",
      directMessage: newMessage
    });
  } catch (error) {
    next(error);
  }
};

const updateDirectMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { directMessageId } = req.params;
    const content = req.body.content || "";
    const trimmedContent = content.trim();

    if (!directMessageId) {
      res.status(400);
      throw new Error("Direct message ID is required");
    }

    if (!trimmedContent) {
      res.status(400);
      throw new Error("Message content is required");
    }

    const directMessage = await getDirectMessageById(directMessageId);

    if (!directMessage) {
      res.status(404);
      throw new Error("Direct message not found");
    }

    const hasAccess = await isUserInConversation(
      directMessage.conversation_id,
      currentUserId
    );

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a participant in this direct conversation");
    }

    if (Number(directMessage.sender_id) !== Number(currentUserId)) {
      res.status(403);
      throw new Error("You can only edit your own direct messages");
    }

    await updateDirectMessageById(directMessageId, trimmedContent);

    const updatedDirectMessage = await getDirectMessageById(directMessageId);

    const otherUserId =
      Number(updatedDirectMessage.user_one_id) === Number(currentUserId)
        ? Number(updatedDirectMessage.user_two_id)
        : Number(updatedDirectMessage.user_one_id);

    const editedDirectMessage = {
      direct_message_id: Number(updatedDirectMessage.direct_message_id),
      conversation_id: Number(updatedDirectMessage.conversation_id),
      sender_id: Number(updatedDirectMessage.sender_id),
      sender_username: updatedDirectMessage.sender_username,
      content: updatedDirectMessage.content,
      reply_to_direct_message_id: updatedDirectMessage.reply_to_direct_message_id
        ? Number(updatedDirectMessage.reply_to_direct_message_id)
        : null,
      reply_to: buildDirectReplyPreview(updatedDirectMessage),
      created_at: updatedDirectMessage.created_at,
      updated_at: updatedDirectMessage.updated_at,
      attachments: [],
      edited: true
    };

    const socketPayload = {
      conversation_id: Number(updatedDirectMessage.conversation_id),
      sender_user_id: Number(currentUserId),
      recipient_user_id: otherUserId,
      directMessage: editedDirectMessage
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`user_${currentUserId}`).emit("direct_message_updated", socketPayload);
      io.to(`user_${otherUserId}`).emit("direct_message_updated", socketPayload);
    }

    res.status(200).json({
      message: "Direct message updated successfully",
      directMessage: editedDirectMessage
    });
  } catch (error) {
    next(error);
  }
};

const deleteDirectMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { directMessageId } = req.params;

    if (!directMessageId) {
      res.status(400);
      throw new Error("Direct message ID is required");
    }

    const directMessage = await getDirectMessageById(directMessageId);

    if (!directMessage) {
      res.status(404);
      throw new Error("Direct message not found");
    }

    const hasAccess = await isUserInConversation(
      directMessage.conversation_id,
      currentUserId
    );

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a participant in this direct conversation");
    }

    if (Number(directMessage.sender_id) !== Number(currentUserId)) {
      res.status(403);
      throw new Error("You can only delete your own direct messages");
    }

    await deleteDirectMessageAttachmentsByMessageId(directMessageId);
    await deleteDirectMessageById(directMessageId);

    const otherUserId =
      Number(directMessage.user_one_id) === Number(currentUserId)
        ? Number(directMessage.user_two_id)
        : Number(directMessage.user_one_id);

    const deletedMessage = {
      direct_message_id: Number(directMessage.direct_message_id),
      conversation_id: Number(directMessage.conversation_id),
      sender_id: Number(directMessage.sender_id),
      recipient_user_id: otherUserId
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`user_${currentUserId}`).emit("direct_message_deleted", deletedMessage);
      io.to(`user_${otherUserId}`).emit("direct_message_deleted", deletedMessage);
    }

    res.status(200).json({
      message: "Direct message deleted successfully",
      data: deletedMessage
    });
  } catch (error) {
    next(error);
  }
};

const deleteDirectConversationForMe = async (req, res, next) => {
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

    await hideDirectConversationForUser(conversationId, currentUserId);

    res.status(200).json({
      message: "Direct conversation deleted for you"
    });
  } catch (error) {
    next(error);
  }
};

const markDirectConversationRead = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const { conversationId } = req.params;

    if (!conversationId) {
      res.status(400);
      throw new Error("Conversation ID is required");
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

    const readState = await markDirectConversationAsRead(
      conversationId,
      currentUserId
    );

    res.status(200).json({
      message: "Direct conversation marked as read",
      data: readState
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadDirectConversationCounts = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const unreadRows = await getUnreadDirectConversationCountsByUserId(currentUserId);

    const conversations = {};

    unreadRows.forEach((row) => {
      conversations[String(row.conversation_id)] = Number(row.unread_count || 0);
    });

    res.status(200).json({
      message: "Unread direct conversation counts fetched successfully",
      conversations
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
  updateDirectMessage,
  deleteDirectMessage,
  deleteDirectConversationForMe,
  markDirectConversationRead,
  getUnreadDirectConversationCounts
};