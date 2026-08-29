const messageModel = require("../models/messageModel");
const { canManageServerContent } = require("../models/permissionModel");
const { deleteStoredFiles } = require("../services/attachmentFileService");
const { markUploadedFileCommitted } = require("../middleware/uploadMiddleware");

const MAX_MESSAGE_LENGTH = 4000;

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

const buildReplyPreview = (message) => {
  if (!message?.reply_to_message_id) {
    return null;
  }

  return {
    message_id: Number(message.reply_to_message_id),
    user_id: message.reply_to_user_id ? Number(message.reply_to_user_id) : null,
    username: message.reply_to_username || "Unknown user",
    content: message.reply_to_content || ""
  };
};

const normalizeEmoji = (emoji) => {
  const safeEmoji = String(emoji || "").trim();

  if (!safeEmoji || safeEmoji.length > 16) {
    return "";
  }

  return safeEmoji;
};

const buildMessageResponse = (message) => ({
  ...message,
  message_id: Number(message.message_id),
  channel_id: Number(message.channel_id),
  server_id: message.server_id ? Number(message.server_id) : null,
  user_id: Number(message.user_id),
  content: message.content,
  reply_to: buildReplyPreview(message),
  reactions: Array.isArray(message.reactions) ? message.reactions : [],
  pinned: Boolean(message.pinned || message.pinned_at),
  pinned_by: message.pinned_by ? Number(message.pinned_by) : null,
  pinned_by_username: message.pinned_by_username || null,
  pinned_at: message.pinned_at || null
});

const extractMentionedUserIds = async (channelId, content, senderUserId) => {
  const mentionMatches = String(content || "").matchAll(/@([a-zA-Z0-9_.-]+)/g);
  const mentionedUsernames = new Set(
    Array.from(mentionMatches)
      .map((match) => match[1]?.trim().toLowerCase())
      .filter(Boolean)
  );

  if (mentionedUsernames.size === 0) {
    return [];
  }

  const serverMembers = await messageModel.getMentionableServerMembersByChannelId(
    channelId
  );

  return serverMembers
    .filter((member) => {
      const memberUsername = String(member.username || "").toLowerCase();

      return (
        mentionedUsernames.has(memberUsername) &&
        String(member.user_id) !== String(senderUserId)
      );
    })
    .map((member) => Number(member.user_id));
};

const createMessage = async (req, res, next) => {
  try {
    const channelId = req.body.channel_id || req.body.channelId;
    const content = req.body.content || "";
    const replyToMessageId =
      req.body.reply_to_message_id ||
      req.body.replyToMessageId ||
      null;
    const userId = req.user.user_id;
    const attachmentPayload = createAttachmentPayload(req.file);

    if (!channelId) {
      res.status(400);
      throw new Error("Channel ID is required");
    }

    const trimmedContent = String(content || "").trim();

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      res.status(400);
      throw new Error(`Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    if (!trimmedContent && !attachmentPayload) {
      res.status(400);
      throw new Error("Message content or attachment is required");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    let replyToMessage = null;

    if (replyToMessageId) {
      replyToMessage = await messageModel.getMessageById(replyToMessageId);

      if (!replyToMessage) {
        res.status(404);
        throw new Error("Reply target message not found");
      }

      if (String(replyToMessage.channel_id) !== String(channelId)) {
        res.status(400);
        throw new Error("You can only reply to messages in the same channel");
      }
    }

    const mentionedUserIds = trimmedContent
      ? await extractMentionedUserIds(channelId, trimmedContent, userId)
      : [];

    const { messageResult, attachmentResult } =
      await messageModel.createMessageWithMetadata({
        channelId,
        userId,
        content: trimmedContent,
        replyToMessageId: replyToMessageId || null,
        mentionedUserIds,
        attachmentData: attachmentPayload
      });
    const messageId = messageResult.insertId;
    let attachment = null;

    if (attachmentPayload && attachmentResult) {
      markUploadedFileCommitted(req);

      attachment = {
        attachment_id: attachmentResult.insertId,
        message_id: messageId,
        ...attachmentPayload
      };
    }

    const serverId = await messageModel.getChannelServerId(channelId);
    const fullCreatedMessage = await messageModel.getMessageById(messageId);

    const createdMessage = {
      message_id: messageId,
      channel_id: Number(channelId),
      server_id: serverId ? Number(serverId) : null,
      user_id: userId,
      username: req.user.username,
      content: trimmedContent,
      reply_to_message_id: replyToMessageId ? Number(replyToMessageId) : null,
      reply_to: buildReplyPreview(fullCreatedMessage),
      mentioned_user_ids: mentionedUserIds,
      attachments: attachment ? [attachment] : [],
      reactions: [],
      pinned: false,
      pinned_by: null,
      pinned_by_username: null,
      pinned_at: null,
      created_at: new Date().toISOString(),
      updated_at: null
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${channelId}`).emit("new_message", createdMessage);

      if (serverId) {
        const serverMembers = await messageModel.getChannelServerMemberIds(channelId);

        serverMembers.forEach((member) => {
          io.to(`user_${member.user_id}`).emit("channel_message_notification", {
            server_id: Number(serverId),
            channel_id: Number(channelId),
            sender_user_id: Number(userId),
            mentioned_user_ids: mentionedUserIds,
            message: createdMessage
          });
        });
      }
    }

    res.status(201).json({
      message: "Message created successfully",
      data: createdMessage
    });
  } catch (error) {
    next(error);
  }
};

const getChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;
    const limit = req.query.limit;
    const beforeMessageId = req.query.beforeMessageId || req.query.before;
    const aroundMessageId = req.query.aroundMessageId || req.query.around;

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const { messages, pagination } = await messageModel.getMessagesByChannelId(
      channelId,
      {
        limit,
        beforeMessageId,
        aroundMessageId,
        currentUserId: userId
      }
    );

    const messagesWithReplies = messages.map(buildMessageResponse);

    res.status(200).json({
      message: "Channel messages fetched successfully",
      messages: messagesWithReplies,
      pagination
    });
  } catch (error) {
    next(error);
  }
};

const searchChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;
    const searchTerm = (req.query.q || req.query.query || "").trim();

    if (!channelId) {
      res.status(400);
      throw new Error("Channel ID is required");
    }

    if (searchTerm.length < 2) {
      res.status(400);
      throw new Error("Search term must be at least 2 characters");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const matches = await messageModel.searchMessagesByChannelId(
      channelId,
      searchTerm
    );

    res.status(200).json({
      message: "Channel message matches fetched successfully",
      query: searchTerm,
      total: matches.length,
      matches
    });
  } catch (error) {
    next(error);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;
    const content = req.body.content || "";
    const trimmedContent = String(content || "").trim();

    if (!messageId) {
      res.status(400);
      throw new Error("Message ID is required");
    }

    if (!trimmedContent) {
      res.status(400);
      throw new Error("Message content is required");
    }

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      res.status(400);
      throw new Error(`Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      res.status(404);
      throw new Error("Message not found");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      message.channel_id,
      userId
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    if (Number(message.user_id) !== Number(userId)) {
      res.status(403);
      throw new Error("You can only edit your own messages");
    }

    await messageModel.updateMessageById(messageId, trimmedContent);

    const updatedMessage = await messageModel.getMessageById(messageId);

    const editedMessage = {
      ...buildMessageResponse(updatedMessage),
      edited: true
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${updatedMessage.channel_id}`).emit(
        "message_updated",
        editedMessage
      );
    }

    res.status(200).json({
      message: "Message updated successfully",
      data: editedMessage
    });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    if (!messageId) {
      res.status(400);
      throw new Error("Message ID is required");
    }

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      res.status(404);
      throw new Error("Message not found");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      message.channel_id,
      userId
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const permission = await canManageServerContent(message.server_id, userId);
    const canDeleteMessage =
      Number(message.user_id) === Number(userId) || permission.allowed;

    if (!canDeleteMessage) {
      res.status(403);
      throw new Error("You can only delete your own messages unless you are a server owner or admin");
    }

    const attachments = await messageModel.getMessageAttachmentsByMessageId(messageId);

    await messageModel.deleteMessageAttachmentsByMessageId(messageId);
    await messageModel.deleteMessageById(messageId);
    await deleteStoredFiles(attachments);

    const deletedMessage = {
      message_id: Number(message.message_id),
      channel_id: Number(message.channel_id),
      server_id: message.server_id ? Number(message.server_id) : null,
      user_id: Number(message.user_id)
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${message.channel_id}`).emit("message_deleted", deletedMessage);
    }

    res.status(200).json({
      message: "Message deleted successfully",
      data: deletedMessage
    });
  } catch (error) {
    next(error);
  }
};

const toggleMessageReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;
    const emoji = normalizeEmoji(req.body.emoji);

    if (!messageId) {
      res.status(400);
      throw new Error("Message ID is required");
    }

    if (!emoji) {
      res.status(400);
      throw new Error("A valid emoji is required");
    }

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      res.status(404);
      throw new Error("Message not found");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      message.channel_id,
      userId
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const result = await messageModel.toggleMessageReaction(
      messageId,
      userId,
      emoji
    );

    const payload = {
      message_id: Number(message.message_id),
      channel_id: Number(message.channel_id),
      server_id: message.server_id ? Number(message.server_id) : null,
      user_id: Number(userId),
      emoji,
      action: result.action,
      reactions: result.reactions
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${message.channel_id}`).emit(
        "message_reaction_updated",
        payload
      );
    }

    res.status(200).json({
      message: "Message reaction updated successfully",
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

const pinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      res.status(404);
      throw new Error("Message not found");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      message.channel_id,
      userId
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const permission = await canManageServerContent(message.server_id, userId);

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can pin channel messages");
    }

    const pinnedMessage = await messageModel.pinMessageById(messageId, userId);
    const payload = buildMessageResponse(pinnedMessage);

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${message.channel_id}`).emit("message_pin_updated", payload);
    }

    res.status(200).json({
      message: "Message pinned successfully",
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

const unpinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      res.status(404);
      throw new Error("Message not found");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      message.channel_id,
      userId
    );

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const permission = await canManageServerContent(message.server_id, userId);

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can unpin channel messages");
    }

    await messageModel.unpinMessageById(messageId);

    const payload = {
      ...buildMessageResponse(message),
      pinned: false,
      pinned_by: null,
      pinned_by_username: null,
      pinned_at: null
    };

    const io = req.app.get("io");

    if (io) {
      io.to(`channel_${message.channel_id}`).emit("message_pin_updated", payload);
    }

    res.status(200).json({
      message: "Message unpinned successfully",
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

const getPinnedChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const pinnedMessages = await messageModel.getPinnedMessagesByChannelId(
      channelId,
      userId
    );

    res.status(200).json({
      message: "Pinned channel messages fetched successfully",
      messages: pinnedMessages.map(buildMessageResponse)
    });
  } catch (error) {
    next(error);
  }
};

const markChannelAsRead = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;

    if (!channelId) {
      res.status(400);
      throw new Error("Channel ID is required");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const readState = await messageModel.markChannelAsRead(channelId, userId);

    res.status(200).json({
      message: "Channel marked as read",
      data: readState
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadChannelCounts = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const unreadRows = await messageModel.getUnreadChannelCountsByUserId(userId);

    const channels = {};
    const servers = {};

    unreadRows.forEach((row) => {
      const channelKey = String(row.channel_id);
      const serverKey = String(row.server_id);
      const unreadCount = Number(row.unread_count || 0);

      channels[channelKey] = unreadCount;
      servers[serverKey] = Number(servers[serverKey] || 0) + unreadCount;
    });

    res.status(200).json({
      message: "Unread channel counts fetched successfully",
      channels,
      servers
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadMentionCounts = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const mentionRows = await messageModel.getUnreadMentionCountsByUserId(userId);

    const channels = {};
    const servers = {};

    mentionRows.forEach((row) => {
      const channelKey = String(row.channel_id);
      const serverKey = String(row.server_id);
      const mentionCount = Number(row.mention_count || 0);

      channels[channelKey] = mentionCount;
      servers[serverKey] = Number(servers[serverKey] || 0) + mentionCount;
    });

    res.status(200).json({
      message: "Unread mention counts fetched successfully",
      channels,
      servers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMessage,
  getChannelMessages,
  searchChannelMessages,
  updateMessage,
  deleteMessage,
  toggleMessageReaction,
  pinMessage,
  unpinMessage,
  getPinnedChannelMessages,
  markChannelAsRead,
  getUnreadChannelCounts,
  getUnreadMentionCounts
};
