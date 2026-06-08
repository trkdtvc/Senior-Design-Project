import { apiRequest } from "./apiClient";

export const createServerInvite = async (serverId, token) =>
  apiRequest(`/server-invites/${serverId}`, {
    method: "POST",
    token
  });

export const getServerInvites = async (serverId, token) =>
  apiRequest(`/server-invites/${serverId}`, {
    token
  });

export const joinServerByInvite = async (inviteCode, token) =>
  apiRequest("/server-invites/join", {
    method: "POST",
    token,
    body: {
      invite_code: inviteCode.trim().toUpperCase()
    }
  });
