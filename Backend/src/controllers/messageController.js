const messageModel = require("../models/messageModel");

const createMessage = async (req, res, next) => {
  try {
    const channelId = req.body.channel_id || req.body.channelId;
    const content = req.body.content;
    const userId = req.user.user_id;

    if (!channelId || !content) {
      res.status(400);
      throw new Error("Channel ID and content are required");
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      res.status(400);
      throw new Error("Channel ID and content are required");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const result = await messageModel.createMessage(channelId, userId, trimmedContent);
    const serverId = await messageModel.getChannelServerId(channelId);

    const createdMessage = {
      message_id: result.insertId,
      channel_id: Number(channelId),
      server_id: serverId ? Number(serverId) : null,
      user_id: userId,
      username: req.user.username,
      content: trimmedContent,
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