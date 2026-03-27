const channelModel = require("../models/channelModel");

const createChannel = async (req, res) => {
  try {
    const { serverId, channelName } = req.body;
    const userId = req.user.user_id;

    if (!serverId || !channelName) {
      return res.status(400).json({
        message: "Server ID and channel name are required"
      });
    }

    const isMember = await channelModel.isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this server"
      });
    }

    const result = await channelModel.createChannel(serverId, channelName);

    return res.status(201).json({
      message: "Channel created successfully",
      channel: {
        channel_id: result.insertId,
        server_id: Number(serverId),
        channel_name: channelName
      }
    });
  } catch (error) {
    console.error("Create channel error:", error);
    return res.status(500).json({
      message: "Server error while creating channel"
    });
  }
};

const getServerChannels = async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await channelModel.isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this server"
      });
    }

    const channels = await channelModel.getChannelsByServerId(serverId);

    return res.status(200).json(channels);
  } catch (error) {
    console.error("Get channels error:", error);
    return res.status(500).json({
      message: "Server error while fetching channels"
    });
  }
};

module.exports = {
  createChannel,
  getServerChannels
};