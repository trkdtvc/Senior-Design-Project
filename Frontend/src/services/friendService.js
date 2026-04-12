const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

export const getFriends = async (token) => {
  const response = await fetch(`${API_BASE_URL}/friends`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const sendFriendRequest = async (token, payload) => {
  const response = await fetch(`${API_BASE_URL}/friends/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  return handleResponse(response);
};

export const getIncomingFriendRequests = async (token) => {
  const response = await fetch(`${API_BASE_URL}/friends/requests/incoming`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const getOutgoingFriendRequests = async (token) => {
  const response = await fetch(`${API_BASE_URL}/friends/requests/outgoing`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const acceptFriendRequest = async (token, requestId) => {
  const response = await fetch(
    `${API_BASE_URL}/friends/requests/${requestId}/accept`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse(response);
};

export const rejectFriendRequest = async (token, requestId) => {
  const response = await fetch(
    `${API_BASE_URL}/friends/requests/${requestId}/reject`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse(response);
};