const notificationSettingsModel = require("../models/notificationSettingsModel");

const getNotificationSettings = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const settings = await notificationSettingsModel.getNotificationSettingsByUserId(userId);

    res.status(200).json({
      message: "Notification settings fetched successfully",
      settings
    });
  } catch (error) {
    next(error);
  }
};

const setServerMute = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { serverId } = req.params;
    const muted = Boolean(req.body?.muted);

    const hasAccess = await notificationSettingsModel.isUserMemberOfServer(serverId, userId);

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a member of this server");
    }

    await notificationSettingsModel.setServerMuteState(userId, serverId, muted);

    const settings = await notificationSettingsModel.getNotificationSettingsByUserId(userId);

    res.status(200).json({
      message: muted ? "Server muted successfully" : "Server unmuted successfully",
      settings
    });
  } catch (error) {
    next(error);
  }
};

const setChannelMute = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { channelId } = req.params;
    const muted = Boolean(req.body?.muted);

    const hasAccess = await notificationSettingsModel.isUserMemberOfChannelServer(channelId, userId);

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a member of this channel's server");
    }

    await notificationSettingsModel.setChannelMuteState(userId, channelId, muted);

    const settings = await notificationSettingsModel.getNotificationSettingsByUserId(userId);

    res.status(200).json({
      message: muted ? "Channel muted successfully" : "Channel unmuted successfully",
      settings
    });
  } catch (error) {
    next(error);
  }
};

const setDirectConversationMute = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { conversationId } = req.params;
    const muted = Boolean(req.body?.muted);

    const hasAccess = await notificationSettingsModel.isUserInDirectConversation(
      conversationId,
      userId
    );

    if (!hasAccess) {
      res.status(403);
      throw new Error("You are not a participant in this direct conversation");
    }

    await notificationSettingsModel.setDirectConversationMuteState(
      userId,
      conversationId,
      muted
    );

    const settings = await notificationSettingsModel.getNotificationSettingsByUserId(userId);

    res.status(200).json({
      message: muted
        ? "Direct conversation muted successfully"
        : "Direct conversation unmuted successfully",
      settings
    });
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
