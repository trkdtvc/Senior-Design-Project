const channelModel = require("../models/channelModel");
const { canManageServerContent } = require("../models/permissionModel");
const { deleteStoredFiles } = require("../services/attachmentFileService");

const MAX_CHANNEL_NAME_LENGTH = 100;

const normalizeChannelName = (value) => String(value || "").trim();

const validateChannelName = (channelName, res) => {
  if (!channelName) {
    res.status(400);
    throw new Error("Channel name is required");
  }

  if (channelName.length > MAX_CHANNEL_NAME_LENGTH) {
    res.status(400);
    throw new Error(`Channel name cannot exceed ${MAX_CHANNEL_NAME_LENGTH} characters`);
  }
};

const createChannel = async (req, res, next) => {
  try {
    const serverId = req.body.server_id || req.body.serverId;
    const channelName = normalizeChannelName(
      req.body.channel_name || req.body.channelName
    );
    const userId = req.user.user_id;

    if (!serverId) {
      res.status(400);
      throw new Error("Server ID is required");
    }

    validateChannelName(channelName, res);

    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can create channels");
    }

    const existingChannel = await channelModel.getChannelByName(serverId, channelName);

    if (existingChannel) {
      res.status(400);
      throw new Error("A channel with that name already exists");
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

const updateChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.user_id;
    const channelName = normalizeChannelName(
      req.body?.channel_name ?? req.body?.channelName
    );

    validateChannelName(channelName, res);

    const channel = await channelModel.getChannelById(channelId);

    if (!channel) {
      res.status(404);
      throw new Error("Channel not found");
    }

    const permission = await canManageServerContent(channel.server_id, userId);

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can edit channels");
    }

    if (String(channel.channel_name).trim().toLowerCase() === "general") {
      res.status(400);
      throw new Error('The "general" channel cannot be renamed');
    }

    const duplicateChannel = await channelModel.getChannelByName(
      channel.server_id,
      channelName
    );

    if (
      duplicateChannel &&
      String(duplicateChannel.channel_id) !== String(channelId)
    ) {
      res.status(400);
      throw new Error("A channel with that name already exists");
    }

    await channelModel.updateChannelName(channelId, channelName);
    const updatedChannel = await channelModel.getChannelById(channelId);
    const io = req.app.get("io");

    if (io) {
      io.to([`server_${channel.server_id}`, `channel_${channelId}`]).emit(
        "channel_updated",
        updatedChannel
      );
    }

    res.status(200).json({
      message: "Channel updated successfully",
      channel: updatedChannel
    });
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

    const attachments = await channelModel.getChannelAttachmentUrls(channelId);

    await channelModel.deleteChannel(channelId);
    await deleteStoredFiles(attachments);

    const io = req.app.get("io");

    if (io) {
      io.to(`server_${channel.server_id}`).emit("channel_deleted", {
        channel_id: Number(channelId),
        server_id: Number(channel.server_id)
      });
    }

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
  updateChannel,
  deleteChannel
};
