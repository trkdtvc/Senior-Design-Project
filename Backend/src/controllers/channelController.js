const channelModel = require("../models/channelModel");

const createChannel = async (req, res, next) => {
  try {
    const serverId = req.body.server_id || req.body.serverId;
    const channelName = req.body.channel_name || req.body.channelName;
    const userId = req.user.user_id;

    if (!serverId || !channelName) {
      res.status(400);
      throw new Error("Server ID and channel name are required");
    }

    const isMember = await channelModel.isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    const result = await channelModel.createChannel(serverId, channelName);

    res.status(201).json({
      message: "Channel created successfully",
      channel: {
        channel_id: result.insertId,
        server_id: Number(serverId),
        channel_name: channelName
      }
    });
  } catch (error) {
    next(error);
  }
};

const getServerChannels = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await channelModel.isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    const channels = await channelModel.getChannelsByServerId(serverId);

    res.status(200).json(channels);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChannel,
  getServerChannels
};