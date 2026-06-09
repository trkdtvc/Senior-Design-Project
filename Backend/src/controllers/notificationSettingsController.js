const notificationSettingsModel = require("../models/notificationSettingsModel");
const channelModel = require("../models/channelModel");
const messageModel = require("../models/messageModel");
const { isUserInConversation } = require("../models/directMessageModel");

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const getTargetId = (req, key) => Number(req.params[key] || req.body[key]);

const sendSettings = (res, settings, message) =>
  res.json({
    message,
    settings
  });

const getNotificationSettings = async (req, res, next) => {
  try {
    const settings = await notificationSettingsModel.getNotificationSettings(
      req.user.user_id
    );

    sendSettings(res, settings, "Notification settings fetched successfully.");
  } catch (error) {
    next(error);
  }
};

const setServerMute = async (req, res, next) => {
  try {
    const serverId = getTargetId(req, "serverId");
    const muted = toBoolean(req.body.muted);

    if (!serverId) {
      return res.status(400).json({ message: "Server ID is required." });
    }

    const isMember = await channelModel.isUserMemberOfServer(
      serverId,
      req.user.user_id
    );

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this server." });
    }

    const settings = await notificationSettingsModel.setServerMute(
      req.user.user_id,
      serverId,
      muted
    );

    sendSettings(
      res,
      settings,
      muted ? "Server muted successfully." : "Server unmuted successfully."
    );
  } catch (error) {
    next(error);
  }
};

const setChannelMute = async (req, res, next) => {
  try {
    const channelId = getTargetId(req, "channelId");
    const muted = toBoolean(req.body.muted);

    if (!channelId) {
      return res.status(400).json({ message: "Channel ID is required." });
    }

    const isMember = await messageModel.isUserMemberOfChannelServer(
      channelId,
      req.user.user_id
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel's server." });
    }

    const settings = await notificationSettingsModel.setChannelMute(
      req.user.user_id,
      channelId,
      muted
    );

    sendSettings(
      res,
      settings,
      muted ? "Channel muted successfully." : "Channel unmuted successfully."
    );
  } catch (error) {
    next(error);
  }
};

const setDirectConversationMute = async (req, res, next) => {
  try {
    const conversationId = getTargetId(req, "conversationId");
    const muted = toBoolean(req.body.muted);

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required." });
    }

    const hasAccess = await isUserInConversation(conversationId, req.user.user_id);

    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this conversation." });
    }

    const settings = await notificationSettingsModel.setDirectConversationMute(
      req.user.user_id,
      conversationId,
      muted
    );

    sendSettings(
      res,
      settings,
      muted ? "Direct message muted successfully." : "Direct message unmuted successfully."
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotificationSettings,
  setServerMute,
  setChannelMute,
  setDirectConversationMute
};
