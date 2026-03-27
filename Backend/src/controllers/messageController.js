const messageModel = require("../models/messageModel");

const createMessage = async (req, res) => {
  try {
    const { channelId, content } = req.body;
    const userId = req.user.user_id;

    if (!channelId || !content) {
      return res.status(400).json({
        message: "Channel ID and content are required"
      });
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this channel's server"
      });
    }

    const result = await messageModel.createMessage(channelId, userId, content);

    return res.status(201).json({
      message: "Message created successfully",
      data: {
        message_id: result.insertId,
        channel_id: Number(channelId),
        user_id: userId,
        content
      }
    });
  } catch (error) {
    console.error("Create message error:", error);
    return res.status(500).json({
      message: "Server error while creating message"
    });
  }
};

const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this channel's server"
      });
    }

    const messages = await messageModel.getMessagesByChannelId(channelId);

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({
      message: "Server error while fetching messages"
    });
  }
};

module.exports = {
  createMessage,
  getChannelMessages
};