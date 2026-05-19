const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const parseResponseBody = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");

  return text ? { message: text } : null;
};

const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed.");
  }

  return data;
};

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`
});

const getJsonHeaders = (token) => ({
  ...getAuthHeaders(token),
  "Content-Type": "application/json"
});

export const getServerChannels = async (token, serverId) => {
  const response = await fetch(`${API_BASE_URL}/channels/${serverId}`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const createChannel = async (token, channelData) => {
  const response = await fetch(`${API_BASE_URL}/channels`, {
    method: "POST",
    headers: getJsonHeaders(token),
    body: JSON.stringify({
      server_id: channelData.server_id,
      channel_name: channelData.channel_name?.trim() || ""
    })
  });

  return handleResponse(response);
};

export const deleteChannel = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
    method: "DELETE",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};