import { apiRequest } from "./apiClient";

export const getServerMembers = async (serverId, token) =>
  apiRequest(`/server-members/${serverId}`, {
    token
  });

export const leaveServer = async (serverId, token) =>
  apiRequest(`/server-members/${serverId}/leave`, {
    method: "DELETE",
    token
  });

export const removeServerMember = async (serverId, memberId, token) =>
  apiRequest(`/server-members/${serverId}/members/${memberId}`, {
    method: "DELETE",
    token
  });

export const updateServerMemberRole = async (serverId, memberId, role, token) =>
  apiRequest(`/server-members/${serverId}/members/${memberId}/role`, {
    method: "PATCH",
    token,
    body: { role }
  });

export const getServerBans = async (serverId, token) =>
  apiRequest(`/server-members/${serverId}/bans`, {
    token
  });

export const banServerMember = async (serverId, memberId, token, reason = "") =>
  apiRequest(`/server-members/${serverId}/members/${memberId}/ban`, {
    method: "POST",
    token,
    body: { reason }
  });

export const unbanServerUser = async (serverId, userId, token) =>
  apiRequest(`/server-members/${serverId}/bans/${userId}`, {
    method: "DELETE",
    token
  });

