const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

export const getChannelMessages = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/messages/${channelId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const createMessage = async (token, messageData) => {
  const hasAttachment = !!messageData.attachment;

  let body;
  let headers = {
    Authorization: `Bearer ${token}`
  };

  if (hasAttachment) {
    body = new FormData();
    body.append("channel_id", messageData.channel_id);
    body.append("content", messageData.content || "");
    body.append("attachment", messageData.attachment);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(messageData);
  }

  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    headers,
    body
  });

  return handleResponse(response);
};