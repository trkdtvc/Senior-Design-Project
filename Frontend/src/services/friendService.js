import { apiRequest } from "./apiClient";

export const getFriends = async (token) =>
  apiRequest("/friends", {
    token
  });

export const getIncomingFriendRequests = async (token) =>
  apiRequest("/friends/requests/incoming", {
    token
  });

export const getOutgoingFriendRequests = async (token) =>
  apiRequest("/friends/requests/outgoing", {
    token
  });

export const sendFriendRequest = async (token, username) =>
  apiRequest("/friends/requests", {
    method: "POST",
    token,
    body: {
      username: username.trim()
    }
  });

export const respondToFriendRequest = async (token, requestId, action) =>
  apiRequest(`/friends/requests/${requestId}/${action}`, {
    method: "PATCH",
    token
  });

export const removeFriend = async (token, friendId) =>
  apiRequest(`/friends/${friendId}`, {
    method: "DELETE",
    token
  });
