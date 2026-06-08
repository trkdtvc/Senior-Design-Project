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
