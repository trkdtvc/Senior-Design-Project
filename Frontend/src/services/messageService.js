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

const createMessageFormData = ({
  channel_id,
  content = "",
  attachment,
  reply_to_message_id
}) => {
  const formData = new FormData();

  formData.append("channel_id", channel_id);
  formData.append("content", content);

  if (reply_to_message_id) {
    formData.append("reply_to_message_id", reply_to_message_id);
  }

  if (attachment) {
    formData.append("attachment", attachment);
  }

  return formData;
};

export const getChannelMessages = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/messages/${channelId}`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const createMessage = async (token, messageData) => {
  const hasAttachment = Boolean(messageData?.attachment);

  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    headers: hasAttachment ? getAuthHeaders(token) : getJsonHeaders(token),
    body: hasAttachment
      ? createMessageFormData(messageData)
      : JSON.stringify({
          channel_id: messageData.channel_id,
          content: messageData.content || "",
          reply_to_message_id: messageData.reply_to_message_id || null
        })
  });

  return handleResponse(response);
};

export const updateMessage = async (token, messageId, content) => {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: "PUT",
    headers: getJsonHeaders(token),
    body: JSON.stringify({ content })
  });

  return handleResponse(response);
};

export const deleteMessage = async (token, messageId) => {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: "DELETE",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const markChannelAsRead = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/messages/${channelId}/read`, {
    method: "PATCH",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const getUnreadChannelCounts = async (token) => {
  const response = await fetch(`${API_BASE_URL}/messages/unread-counts`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};