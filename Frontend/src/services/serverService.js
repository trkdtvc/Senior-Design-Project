import { apiRequest } from "./apiClient";

export const getUserServers = async (token) =>
  apiRequest("/servers", {
    token
  });

export const createServer = async (token, serverData) =>
  apiRequest("/servers", {
    method: "POST",
    token,
    body: {
      server_name: serverData.server_name?.trim() || "",
      description: serverData.description?.trim() || ""
    }
  });

export const deleteServer = async (token, serverId) =>
  apiRequest(`/servers/${serverId}`, {
    method: "DELETE",
    token
  });
