const channelModel = require("../models/channelModel");
const { canManageServerContent } = require("../models/permissionModel");

const createChannel = async (req, res, next) => {
  try {
    const serverId = req.body.server_id || req.body.serverId;
    const channelName = req.body.channel_name || req.body.channelName;
    const userId = req.user.user_id;

    if (!serverId || !channelName) {
      res.status(400);
      throw new Error("Server ID and channel name are required");
    }

    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can create channels");
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

const deleteChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;

    if (!channelId) {
      res.status(400);
      throw new Error("Channel ID is required");
    }

    const channel = await channelModel.getChannelById(channelId);

    if (!channel) {
      res.status(404);
      throw new Error("Channel not found");
    }

    const permission = await canManageServerContent(channel.server_id, userId);

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can delete channels");
    }

    const serverChannels = await channelModel.getChannelsByServerId(
      channel.server_id
    );

    if (serverChannels.length <= 1) {
      res.status(400);
      throw new Error("You cannot delete the last remaining channel");
    }

    if (channel.channel_name.trim().toLowerCase() === "general") {
      res.status(400);
      throw new Error('The "general" channel cannot be deleted');
    }

    await channelModel.deleteChannel(channelId);

    res.status(200).json({
      message: "Channel deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChannel,
  getServerChannels,
  deleteChannel
};
