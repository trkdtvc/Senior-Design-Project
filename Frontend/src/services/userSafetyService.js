import { apiRequest } from "./apiClient";

export const getBlockedUsers = async (token) =>
  apiRequest("/user-safety/blocked-users", {
    token
  });

export const blockUser = async (token, userId) =>
  apiRequest(`/user-safety/users/${userId}/block`, {
    method: "POST",
    token
  });

export const unblockUser = async (token, userId) =>
  apiRequest(`/user-safety/users/${userId}/block`, {
    method: "DELETE",
    token
  });
