import { apiRequest } from "./apiClient";

export const getBlockedUsers = async (token) =>
  apiRequest("/user-safety/blocked-users", {
    token
  });

export const blockUser = async (token, userId) =>
  apiRequest(`/user-safety/blocks/${userId}`, {
    method: "POST",
    token
  });

export const unblockUser = async (token, userId) =>
  apiRequest(`/user-safety/blocks/${userId}`, {
    method: "DELETE",
    token
  });

export const reportUser = async (token, userId, reportData) =>
  apiRequest(`/user-safety/reports/${userId}`, {
    method: "POST",
    token,
    body: reportData
  });
