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

const createMessage = async (req, res, next) => {
  try {
    const channelId = req.body.channel_id || req.body.channelId;
    const content = req.body.content || "";
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

    const result = await messageModel.createMessage(channelId, userId, trimmedContent);
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

    const createdMessage = {
      message_id: messageId,
      channel_id: Number(channelId),
      server_id: serverId ? Number(serverId) : null,
      user_id: userId,
      username: req.user.username,
      content: trimmedContent,
      attachments: attachment ? [attachment] : [],
      created_at: new Date().toISOString()
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

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMessage,
  getChannelMessages
};