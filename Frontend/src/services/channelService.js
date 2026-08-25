import { apiRequest } from "./apiClient";

export const getServerChannels = async (token, serverId) =>
  apiRequest(`/channels/${serverId}`, {
    token
  });

export const createChannel = async (token, channelData) =>
  apiRequest("/channels", {
    method: "POST",
    token,
    body: {
      server_id: channelData.server_id,
      channel_name: channelData.channel_name?.trim() || ""
    }
  });

export const updateChannel = async (token, channelId, channelData) =>
  apiRequest(`/channels/${channelId}`, {
    method: "PATCH",
    token,
    body: {
      channel_name: channelData.channel_name?.trim() || ""
    }
  });

export const deleteChannel = async (token, channelId) =>
  apiRequest(`/channels/${channelId}`, {
    method: "DELETE",
    token
  });
