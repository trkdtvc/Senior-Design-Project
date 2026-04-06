const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

export const getServerChannels = async (token, serverId) => {
  const response = await fetch(`${API_BASE_URL}/channels/${serverId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const createChannel = async (token, channelData) => {
  const response = await fetch(`${API_BASE_URL}/channels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(channelData)
  });

  return handleResponse(response);
};

export const deleteChannel = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};