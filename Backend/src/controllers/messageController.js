const messageModel = require("../models/messageModel");
const { canManageServerContent } = require("../models/permissionModel");

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

    const trimmedContent = content.trim();

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

    const result = await messageModel.createMessage(
      channelId,
      userId,
      trimmedContent,
      replyToMessageId || null
    );
    const messageId = result.insertId;

    const mentionedUserIds = trimmedContent
      ? await extractMentionedUserIds(channelId, trimmedContent, userId)
      : [];

    if (mentionedUserIds.length > 0) {
      await messageModel.createMessageMentions(messageId, mentionedUserIds);
    }

    let attachment = null;

    if (attachmentPayload) {
      const attachmentResult = await messageModel.createMessageAttachment(
        messageId,
        attachmentPayload
      );

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
        aroundMessageId
      }
    );

    const messagesWithReplies = messages.map((message) => ({
      ...message,
      reply_to: buildReplyPreview(message)
    }));

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

    if (!searchTerm) {
      res.status(400);
      throw new Error("Search term is required");
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
    const trimmedContent = content.trim();

    if (!messageId) {
      res.status(400);
      throw new Error("Message ID is required");
    }

    if (!trimmedContent) {
      res.status(400);
      throw new Error("Message content is required");
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
      ...updatedMessage,
      message_id: Number(updatedMessage.message_id),
      channel_id: Number(updatedMessage.channel_id),
      server_id: updatedMessage.server_id ? Number(updatedMessage.server_id) : null,
      user_id: Number(updatedMessage.user_id),
      content: updatedMessage.content,
      reply_to: buildReplyPreview(updatedMessage),
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

    await messageModel.deleteMessageAttachmentsByMessageId(messageId);
    await messageModel.deleteMessageById(messageId);

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
  markChannelAsRead,
  getUnreadChannelCounts,
  getUnreadMentionCounts
};
