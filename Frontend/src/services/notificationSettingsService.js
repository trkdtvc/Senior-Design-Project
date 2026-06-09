import { apiRequest } from "./apiClient";

export const getNotificationSettings = async (token) =>
  apiRequest("/notification-settings", {
    token
  });

export const setServerMute = async (token, serverId, muted) =>
  apiRequest(`/notification-settings/servers/${serverId}`, {
    method: "PATCH",
    token,
    body: { muted }
  });

export const setChannelMute = async (token, channelId, muted) =>
  apiRequest(`/notification-settings/channels/${channelId}`, {
    method: "PATCH",
    token,
    body: { muted }
  });

export const setDirectConversationMute = async (token, conversationId, muted) =>
  apiRequest(`/notification-settings/direct-conversations/${conversationId}`, {
    method: "PATCH",
    token,
    body: { muted }
  });
