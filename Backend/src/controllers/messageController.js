const messageModel = require("../models/messageModel");

const createMessage = async (req, res, next) => {
  try {
    const { channelId, content } = req.body;
    const userId = req.user.user_id;

    if (!channelId || !content) {
      res.status(400);
      throw new Error("Channel ID and content are required");
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(channelId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    const result = await messageModel.createMessage(channelId, userId, content);

    res.status(201).json({
      message: "Message created successfully",
      data: {
        message_id: result.insertId,
        channel_id: Number(channelId),
        user_id: userId,
        content
      }
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