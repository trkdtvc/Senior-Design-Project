const messageModel = require("../models/messageModel");

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

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const messages = await messageModel.getMessagesByChannelId(channelId);

    const messagesWithReplies = messages.map((message) => ({
      ...message,
      reply_to: buildReplyPreview(message)
    }));

    res.status(200).json(messagesWithReplies);
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

    if (Number(message.user_id) !== Number(userId)) {
      res.status(403);
      throw new Error("You can only delete your own messages");
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

module.exports = {
  createMessage,
  getChannelMessages,
  updateMessage,
  deleteMessage
};